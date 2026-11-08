import { and, eq, gte, isNull, lte } from 'drizzle-orm';
import { formText } from './forms.ts';
import { db } from '#lib/server/db/index.ts';
import { PLACE_STATUSES, PLACE_TYPES, place, placeRevision } from '#lib/server/db/schema.ts';
import { distance, wgs84ToLv95 } from '#lib/geo.ts';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type PlaceRow = typeof place.$inferSelect;

export type PlaceFields = {
	name: string;
	type: (typeof PLACE_TYPES)[number];
	lat: number;
	lng: number;
	ele: number | null;
	description: string | null;
	access: string | null;
	status: (typeof PLACE_STATUSES)[number];
};

/** Validates the place form. Returns raw values (to re-fill the form), parsed fields and errors. */
export function readPlaceFields(form: FormData) {
	const str = (key: string) => formText(form, key);
	const values = {
		name: str('name'),
		type: str('type'),
		lat: str('lat'),
		lng: str('lng'),
		ele: str('ele'),
		description: str('description'),
		access: str('access'),
		status: str('status') || 'aktiv'
	};
	const errors: string[] = [];
	const lat = Number(values.lat);
	const lng = Number(values.lng);
	const ele = values.ele === '' ? null : Number(values.ele.replace(/['’\s]/g, ''));

	if (!values.name || values.name.length > 120)
		errors.push('Bitte gib einen Namen an (max. 120 Zeichen).');
	if (!PLACE_TYPES.includes(values.type as never)) errors.push('Bitte wähle eine Art.');
	if (!PLACE_STATUSES.includes(values.status as never)) errors.push('Ungültiger Status.');
	if (
		!values.lat ||
		!values.lng ||
		!Number.isFinite(lat) ||
		!Number.isFinite(lng) ||
		Math.abs(lat) > 90 ||
		Math.abs(lng) > 180
	) {
		errors.push('Bitte setze den Ort auf der Karte.');
	}
	if (ele !== null && (!Number.isFinite(ele) || ele < -500 || ele > 5000))
		errors.push('Ungültige Höhe.');
	if (values.description.length > 5000 || values.access.length > 2000)
		errors.push('Der Text ist zu lang.');

	const fields: PlaceFields = {
		name: values.name,
		type: values.type as PlaceFields['type'],
		lat,
		lng,
		ele: ele === null ? null : Math.round(ele),
		description: values.description || null,
		access: values.access || null,
		status: values.status as PlaceFields['status']
	};
	return { values, fields, errors };
}

/**
 * Terrain height from the swisstopo height service (swissALTI3D), which covers Switzerland
 * and a margin beyond the border. Returns null when unavailable; the place is saved anyway.
 */
export async function lookupElevation(lat: number, lng: number): Promise<number | null> {
	if (lat < 45.6 || lat > 48.0 || lng < 5.7 || lng > 10.7) return null;
	const { e, n } = wgs84ToLv95(lat, lng);
	try {
		const res = await fetch(
			`https://api3.geo.admin.ch/rest/services/height?easting=${e.toFixed(1)}&northing=${n.toFixed(1)}&sr=2056`,
			{ signal: AbortSignal.timeout(3000) }
		);
		if (!res.ok) return null;
		const height = Number((await res.json()).height);
		return Number.isFinite(height) && height > 0 ? Math.round(height) : null;
	} catch {
		return null;
	}
}

// Revisions --------------------------------------------------------------------

export type PlaceSnapshot = Omit<PlaceFields, never> & { deletedAt: number | null; note?: string };

const snapshotOf = (p: PlaceRow, note?: string): PlaceSnapshot => ({
	name: p.name,
	type: p.type,
	lat: p.lat,
	lng: p.lng,
	ele: p.ele,
	description: p.description,
	access: p.access,
	status: p.status,
	deletedAt: p.deletedAt?.getTime() ?? null,
	...(note ? { note } : {})
});

function record(
	tx: Tx,
	placeId: string,
	userId: string,
	action: (typeof placeRevision.$inferInsert)['action'],
	note?: string
) {
	const row = tx.select().from(place).where(eq(place.id, placeId)).get()!;
	tx.insert(placeRevision)
		.values({ placeId, userId, action, snapshot: snapshotOf(row, note) })
		.run();
}

const sameFields = (a: PlaceFields, b: PlaceRow) =>
	(Object.keys(a) as (keyof PlaceFields)[]).every((k) => a[k] === b[k]);

// Changes ----------------------------------------------------------------------

export async function createPlace(fields: PlaceFields, userId: string) {
	const ele = fields.ele ?? (await lookupElevation(fields.lat, fields.lng));
	const id = crypto.randomUUID();
	db.transaction((tx) => {
		tx.insert(place)
			.values({ ...fields, ele, id, createdBy: userId, updatedBy: userId })
			.run();
		record(tx, id, userId, 'create');
	});
	return id;
}

export async function updatePlace(existing: PlaceRow, fields: PlaceFields, userId: string) {
	const moved = existing.lat !== fields.lat || existing.lng !== fields.lng;
	// An emptied height on a moved place is looked up again.
	const ele = fields.ele ?? (moved ? await lookupElevation(fields.lat, fields.lng) : null);
	const next = { ...fields, ele };
	if (sameFields(next, existing)) return false;

	const onlyStatus = (Object.keys(next) as (keyof PlaceFields)[]).every(
		(k) => k === 'status' || next[k] === existing[k]
	);
	db.transaction((tx) => {
		tx.update(place)
			.set({ ...next, updatedBy: userId })
			.where(eq(place.id, existing.id))
			.run();
		record(tx, existing.id, userId, onlyStatus ? 'status' : 'update');
	});
	return true;
}

/** Soft delete: hidden from map and lists, restorable by admins. */
export function removePlace(id: string, userId: string) {
	db.transaction((tx) => {
		tx.update(place)
			.set({ deletedAt: new Date(), updatedBy: userId })
			.where(eq(place.id, id))
			.run();
		record(tx, id, userId, 'delete');
	});
}

export function restorePlace(id: string, userId: string) {
	db.transaction((tx) => {
		tx.update(place).set({ deletedAt: null, updatedBy: userId }).where(eq(place.id, id)).run();
		record(tx, id, userId, 'restore');
	});
}

/** Puts a place back to the state stored in one of its revisions. */
export function revertPlace(revisionId: string, userId: string) {
	const rev = db.select().from(placeRevision).where(eq(placeRevision.id, revisionId)).get();
	if (!rev) return null;
	const s = rev.snapshot as PlaceSnapshot;
	const stamp = new Intl.DateTimeFormat('de-CH', {
		dateStyle: 'medium',
		timeStyle: 'short'
	}).format(rev.createdAt);
	db.transaction((tx) => {
		tx.update(place)
			.set({
				name: s.name,
				type: s.type,
				lat: s.lat,
				lng: s.lng,
				ele: s.ele,
				description: s.description,
				access: s.access,
				status: s.status,
				deletedAt: s.deletedAt === null ? null : new Date(s.deletedAt),
				updatedBy: userId
			})
			.where(eq(place.id, rev.placeId))
			.run();
		record(tx, rev.placeId, userId, 'update', `Zurückgesetzt auf den Stand vom ${stamp}`);
	});
	return rev.placeId;
}

// Queries ----------------------------------------------------------------------

export const getPlace = (id: string) => db.select().from(place).where(eq(place.id, id)).get();

/** Active places within `radiusM`, nearest first. */
export function placesNear(lat: number, lng: number, radiusM: number, limit = 8) {
	const dLat = radiusM / 111_320;
	const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
	return db
		.select({ id: place.id, name: place.name, type: place.type, lat: place.lat, lng: place.lng })
		.from(place)
		.where(
			and(
				isNull(place.deletedAt),
				gte(place.lat, lat - dLat),
				lte(place.lat, lat + dLat),
				gte(place.lng, lng - dLng),
				lte(place.lng, lng + dLng)
			)
		)
		.all()
		.map((p) => ({ ...p, distanceM: distance({ lat, lng }, p) }))
		.filter((p) => p.distanceM <= radiusM)
		.sort((a, b) => a.distanceM - b.distanceM)
		.slice(0, limit);
}
