import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { user } from './auth.schema';

export * from './auth.schema';

// Shared column helpers ------------------------------------------------------

const id = () =>
	text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
	integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`);

const updatedAt = () =>
	integer('updated_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => new Date());

/** Author reference: authorship survives when a member account is removed. */
const userRef = (name: string) => text(name).references(() => user.id, { onDelete: 'set null' });

export type LineStringGeometry = { type: 'LineString'; coordinates: [number, number, number?][] };

// Archive --------------------------------------------------------------------

export const SEASONS = ['fruehling', 'sommer', 'herbst', 'winter'] as const;

/** One Tschalps (one week-long tour). */
export const tour = sqliteTable('tour', {
	id: id(),
	slug: text('slug').notNull().unique(),
	title: text('title').notNull(),
	year: integer('year').notNull(),
	season: text('season', { enum: SEASONS }),
	startDate: text('start_date'), // ISO date (YYYY-MM-DD)
	endDate: text('end_date'),
	summaryMd: text('summary_md'),
	createdBy: userRef('created_by'),
	createdAt: createdAt(),
	updatedAt: updatedAt()
});

export const tourParticipant = sqliteTable(
	'tour_participant',
	{
		tourId: text('tour_id')
			.notNull()
			.references(() => tour.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		isLeader: integer('is_leader', { mode: 'boolean' }).notNull().default(false)
	},
	(t) => [primaryKey({ columns: [t.tourId, t.userId] })]
);

/** One day of a tour, usually one GPX file. */
export const stage = sqliteTable(
	'stage',
	{
		id: id(),
		tourId: text('tour_id')
			.notNull()
			.references(() => tour.id, { onDelete: 'cascade' }),
		dayIndex: integer('day_index').notNull(),
		date: text('date'),
		title: text('title'),
		reportMd: text('report_md'),
		gpxPath: text('gpx_path'), // original file, relative to UPLOAD_DIR
		geojson: text('geojson', { mode: 'json' }).$type<LineStringGeometry>(), // simplified for display
		minLng: real('min_lng'),
		minLat: real('min_lat'),
		maxLng: real('max_lng'),
		maxLat: real('max_lat'),
		distanceM: real('distance_m'),
		ascentM: real('ascent_m'),
		descentM: real('descent_m'),
		minEle: real('min_ele'),
		maxEle: real('max_ele'),
		nightPlaceId: text('night_place_id').references(() => place.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('stage_tour_idx').on(t.tourId, t.dayIndex),
		index('stage_night_idx').on(t.nightPlaceId)
	]
);

/** Max. 10 per tour (enforced in the upload handler). */
export const tourPhoto = sqliteTable(
	'tour_photo',
	{
		id: id(),
		tourId: text('tour_id')
			.notNull()
			.references(() => tour.id, { onDelete: 'cascade' }),
		stageId: text('stage_id').references(() => stage.id, { onDelete: 'set null' }),
		path: text('path').notNull(),
		caption: text('caption'),
		lat: real('lat'),
		lng: real('lng'),
		takenAt: integer('taken_at', { mode: 'timestamp_ms' }),
		uploadedBy: userRef('uploaded_by'),
		createdAt: createdAt()
	},
	(t) => [index('tour_photo_tour_idx').on(t.tourId)]
);

// Explore --------------------------------------------------------------------

export const PLACE_TYPES = ['stall', 'scheune', 'huette', 'biwak', 'wasser', 'anderes'] as const;
export const PLACE_STATUSES = ['aktiv', 'existiert_nicht_mehr', 'unbekannt'] as const;

export const place = sqliteTable(
	'place',
	{
		id: id(),
		name: text('name').notNull(),
		type: text('type', { enum: PLACE_TYPES }).notNull(),
		lat: real('lat').notNull(),
		lng: real('lng').notNull(),
		ele: real('ele'),
		description: text('description'),
		access: text('access'),
		status: text('status', { enum: PLACE_STATUSES }).notNull().default('aktiv'),
		createdBy: userRef('created_by'),
		updatedBy: userRef('updated_by'),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
		deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }) // soft delete, admins can restore
	},
	(t) => [index('place_lat_lng_idx').on(t.lat, t.lng)]
);

export const PLACE_REVISION_ACTIONS = ['create', 'update', 'status', 'delete', 'restore'] as const;

/** Every change to a place, so edits by members can be reviewed and reverted. */
export const placeRevision = sqliteTable(
	'place_revision',
	{
		id: id(),
		placeId: text('place_id')
			.notNull()
			.references(() => place.id, { onDelete: 'cascade' }),
		userId: userRef('user_id'),
		action: text('action', { enum: PLACE_REVISION_ACTIONS }).notNull(),
		snapshot: text('snapshot', { mode: 'json' }).notNull(), // place row after the change
		createdAt: createdAt()
	},
	(t) => [index('place_revision_place_idx').on(t.placeId)]
);

export const placeComment = sqliteTable(
	'place_comment',
	{
		id: id(),
		placeId: text('place_id')
			.notNull()
			.references(() => place.id, { onDelete: 'cascade' }),
		userId: userRef('user_id'),
		visitedOn: text('visited_on'),
		body: text('body').notNull(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index('place_comment_place_idx').on(t.placeId)]
);

export const placePhoto = sqliteTable(
	'place_photo',
	{
		id: id(),
		placeId: text('place_id')
			.notNull()
			.references(() => place.id, { onDelete: 'cascade' }),
		path: text('path').notNull(),
		caption: text('caption'),
		takenAt: integer('taken_at', { mode: 'timestamp_ms' }),
		uploadedBy: userRef('uploaded_by'),
		createdAt: createdAt()
	},
	(t) => [index('place_photo_place_idx').on(t.placeId)]
);
