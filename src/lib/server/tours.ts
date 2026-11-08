import { and, asc, eq, isNotNull, ne, sql } from 'drizzle-orm';
import { sumTrailMix, type Difficulty, type TrailMix } from '#lib/labels.ts';
import { formText } from './forms.ts';
import { db } from '#lib/server/db/index.ts';
import { stage, tour, tourParticipant, SEASONS, TOUR_KINDS } from '#lib/server/db/schema.ts';
import type { SessionUser } from '#lib/server/auth.ts';
import {
	GpxError,
	parseGpx,
	splitIntoStages,
	stageMetrics,
	toGpx,
	type StageDraft
} from './gpx.ts';
import { placesNear } from './places.ts';
import { readUpload, writeUpload } from './storage.ts';
import { analyseTrails } from './trails.ts';

export const MAX_GPX_BYTES = 20 * 1024 * 1024;

// Permissions ----------------------------------------------------------------

/** Admins, the creator and the tour's participants may edit a tour. */
export function canEditTour(user: SessionUser, t: { id: string; createdBy: string | null }) {
	if (user.role === 'admin' || t.createdBy === user.id) return true;
	return !!db
		.select({ x: sql`1` })
		.from(tourParticipant)
		.where(and(eq(tourParticipant.tourId, t.id), eq(tourParticipant.userId, user.id)))
		.get();
}

// Form parsing -----------------------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type TourFields = {
	title: string;
	year: number;
	season: (typeof SEASONS)[number] | null;
	startDate: string | null;
	endDate: string | null;
	kind: (typeof TOUR_KINDS)[number] | null;
	huts: boolean;
	summaryMd: string | null;
};

/** Validates the tour metadata fields. Returns field values (for re-filling the form) and errors. */
export function readTourFields(form: FormData) {
	const str = (key: string) => formText(form, key);
	const values = {
		title: str('title'),
		year: str('year'),
		season: str('season'),
		startDate: str('startDate'),
		endDate: str('endDate'),
		kind: str('kind'),
		huts: form.get('huts') === 'on',
		summaryMd: str('summaryMd')
	};
	const errors: string[] = [];
	const year = Number(values.year);
	const maxYear = new Date().getFullYear() + 1;

	if (!values.title || values.title.length > 120)
		errors.push('Bitte gib einen Titel an (max. 120 Zeichen).');
	if (!Number.isInteger(year) || year < 1970 || year > maxYear)
		errors.push(`Das Jahr muss zwischen 1970 und ${maxYear} liegen.`);
	if (values.season && !SEASONS.includes(values.season as never))
		errors.push('Ungültige Jahreszeit.');
	if (values.kind && !TOUR_KINDS.includes(values.kind as never)) errors.push('Ungültige Art.');
	for (const key of ['startDate', 'endDate'] as const) {
		if (values[key] && !ISO_DATE.test(values[key])) errors.push('Ungültiges Datum.');
	}
	if (values.startDate && values.endDate && values.endDate < values.startDate) {
		errors.push('Das Enddatum liegt vor dem Startdatum.');
	}
	if (values.summaryMd.length > 20_000) errors.push('Der Bericht ist zu lang.');

	const fields: TourFields = {
		title: values.title,
		year,
		season: (values.season || null) as TourFields['season'],
		startDate: values.startDate || null,
		endDate: values.endDate || null,
		kind: (values.kind || null) as TourFields['kind'],
		huts: values.huts,
		summaryMd: values.summaryMd || null
	};
	return { values, fields, errors };
}

export function slugify(text: string) {
	return text
		.toLowerCase()
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60);
}

export function uniqueSlug(year: number, title: string, excludeTourId?: string) {
	const base = `${year}-${slugify(title) || 'tschalps'}`;
	for (let n = 1; ; n++) {
		const candidate = n === 1 ? base : `${base}-${n}`;
		const taken = db
			.select({ id: tour.id })
			.from(tour)
			.where(
				excludeTourId
					? and(eq(tour.slug, candidate), ne(tour.id, excludeTourId))
					: eq(tour.slug, candidate)
			)
			.get();
		if (!taken) return candidate;
	}
}

// GPX uploads ------------------------------------------------------------------

export type ParsedUpload = { files: { name: string; bytes: Uint8Array }[]; stages: StageDraft[] };

/**
 * Reads and validates uploaded GPX files without touching the database, so a broken
 * file can be reported before anything is saved.
 */
export async function parseGpxUploads(form: FormData, field = 'gpx') {
	const uploads = form.getAll(field).filter((f): f is File => f instanceof File && f.size > 0);
	const errors: string[] = [];
	const files: ParsedUpload['files'] = [];
	const parsed = [];

	for (const file of uploads) {
		if (!file.name.toLowerCase().endsWith('.gpx')) {
			errors.push(`${file.name}: nur GPX-Dateien sind erlaubt.`);
			continue;
		}
		if (file.size > MAX_GPX_BYTES) {
			errors.push(`${file.name}: die Datei ist grösser als 20 MB.`);
			continue;
		}
		const bytes = new Uint8Array(await file.arrayBuffer());
		try {
			parsed.push({ fileName: file.name, gpx: parseGpx(new TextDecoder().decode(bytes)) });
			files.push({ name: file.name, bytes });
		} catch (error) {
			if (!(error instanceof GpxError)) throw error;
			errors.push(`${file.name}: ${error.message}`);
		}
	}

	const result: ParsedUpload = { files, stages: errors.length ? [] : splitIntoStages(parsed) };
	return { result, errors, count: uploads.length };
}

/** A night waypoint this close to a known place links the stage to it. */
const NIGHT_PLACE_RADIUS_M = 300;

/** Trail mix of a route, or null when the swisstopo tiles cannot be loaded right now. */
async function trailMixOf(
	segments: StageDraft['segments'],
	cache?: Parameters<typeof analyseTrails>[1]
) {
	try {
		return await analyseTrails(segments, cache);
	} catch (error) {
		console.warn('Wegtypen konnten nicht berechnet werden:', error);
		return null;
	}
}

/** Stores stage files and rows for parsed uploads, then renumbers the tour's days. */
export async function saveStages(tourId: string, upload: ParsedUpload) {
	const rows: (typeof stage.$inferInsert)[] = [];
	const tiles = new Map();
	for (const draft of upload.stages) {
		const id = crypto.randomUUID();
		const gpxPath = `gpx/${tourId}/${id}.gpx`;
		// Keep the original file when it maps 1:1 to this stage; otherwise write the day's part.
		const content =
			draft.wholeFileIndex !== undefined
				? upload.files[draft.wholeFileIndex].bytes
				: toGpx(draft.title ?? 'Etappe', [{ name: draft.title, segments: draft.segments }]);
		await writeUpload(gpxPath, content);

		const night = draft.night
			? placesNear(draft.night.lat, draft.night.lng, NIGHT_PLACE_RADIUS_M, 1)[0]
			: undefined;

		rows.push({
			id,
			tourId,
			dayIndex: 0, // set by renumberStages
			date: draft.date ?? null,
			title: draft.title ?? null,
			gpxPath,
			nightPlaceId: night?.id ?? null,
			trailMix: await trailMixOf(draft.segments, tiles),
			...stageMetrics(draft.segments)
		});
	}

	db.transaction((tx) => {
		if (rows.length) tx.insert(stage).values(rows).run();
		renumberStages(tourId, tx);
	});
	return rows.length;
}

/**
 * Recomputes the trail mix of a tour's stages from their stored GPX files
 * (e.g. for stages imported before, or when swisstopo was unreachable).
 */
export async function recomputeTrailMix(tourId: string, onlyMissing = false) {
	const tiles = new Map();
	let done = 0;
	let failed = 0;
	for (const s of stagesOf(tourId)) {
		if (!s.gpxPath || (onlyMissing && s.trailMix)) continue;
		const segments = parseGpx(new TextDecoder().decode(await readUpload(s.gpxPath))).tracks.flatMap(
			(t) => t.segments
		);
		const trailMix = await trailMixOf(segments, tiles);
		if (!trailMix) {
			failed++;
			continue;
		}
		db.update(stage).set({ trailMix }).where(eq(stage.id, s.id)).run();
		done++;
	}
	return { done, failed };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Days are numbered by date (undated stages keep their relative order at the end). */
export function renumberStages(tourId: string, tx: Tx | typeof db = db) {
	const stages = tx
		.select({
			id: stage.id,
			date: stage.date,
			dayIndex: stage.dayIndex,
			createdAt: stage.createdAt
		})
		.from(stage)
		.where(eq(stage.tourId, tourId))
		.all()
		.sort(
			(a, b) =>
				(a.date ?? '9999').localeCompare(b.date ?? '9999') ||
				(a.dayIndex || Infinity) - (b.dayIndex || Infinity) ||
				a.createdAt.getTime() - b.createdAt.getTime()
		);
	stages.forEach((s, i) => {
		if (s.dayIndex !== i + 1)
			tx.update(stage)
				.set({ dayIndex: i + 1 })
				.where(eq(stage.id, s.id))
				.run();
	});

	// Fill in the tour's dates from the stages when they weren't entered by hand.
	const dated = stages.filter((s) => s.date);
	if (dated.length) {
		const t = tx
			.select({ startDate: tour.startDate, endDate: tour.endDate })
			.from(tour)
			.where(eq(tour.id, tourId))
			.get();
		if (t && (!t.startDate || !t.endDate)) {
			tx.update(tour)
				.set({
					startDate: t.startDate ?? dated[0].date,
					endDate: t.endDate ?? dated[dated.length - 1].date
				})
				.where(eq(tour.id, tourId))
				.run();
		}
	}
}

export function setParticipants(tourId: string, userIds: string[], tx: Tx | typeof db = db) {
	tx.delete(tourParticipant).where(eq(tourParticipant.tourId, tourId)).run();
	const unique = [...new Set(userIds)];
	if (unique.length) {
		tx.insert(tourParticipant)
			.values(unique.map((userId) => ({ tourId, userId })))
			.run();
	}
}

export const stagesOf = (tourId: string) =>
	db.select().from(stage).where(eq(stage.tourId, tourId)).orderBy(asc(stage.dayIndex)).all();

// Overviews -------------------------------------------------------------------

/** All tours with summed stage stats and bounding box, newest first. */
export function listTourSummaries() {
	const mixes = new Map<string, TrailMix[]>();
	for (const r of db
		.select({ tourId: stage.tourId, trailMix: stage.trailMix })
		.from(stage)
		.where(isNotNull(stage.trailMix))
		.all()) {
		mixes.set(r.tourId, [...(mixes.get(r.tourId) ?? []), r.trailMix!]);
	}

	return db
		.select({
			id: tour.id,
			slug: tour.slug,
			title: tour.title,
			year: tour.year,
			season: tour.season,
			startDate: tour.startDate,
			endDate: tour.endDate,
			kind: tour.kind,
			huts: tour.huts,
			summaryMd: sql<number>`${tour.summaryMd} is not null and ${tour.summaryMd} != ''`,
			days: sql<number>`count(${stage.id})`,
			// 'T1' < … < 'T6' sorts as text.
			difficulty: sql<Difficulty | null>`max(${stage.difficulty})`,
			distanceM: sql<number | null>`sum(${stage.distanceM})`,
			ascentM: sql<number | null>`sum(${stage.ascentM})`,
			descentM: sql<number | null>`sum(${stage.descentM})`,
			maxEle: sql<number | null>`max(${stage.maxEle})`,
			minLng: sql<number | null>`min(${stage.minLng})`,
			minLat: sql<number | null>`min(${stage.minLat})`,
			maxLng: sql<number | null>`max(${stage.maxLng})`,
			maxLat: sql<number | null>`max(${stage.maxLat})`
		})
		.from(tour)
		.leftJoin(stage, eq(stage.tourId, tour.id))
		.groupBy(tour.id)
		.orderBy(sql`${tour.year} desc`, sql`${tour.startDate} desc`, tour.title)
		.all()
		.map(({ id, summaryMd, minLng, minLat, maxLng, maxLat, ...t }) => ({
			...t,
			trailMix: sumTrailMix(mixes.get(id) ?? []),
			hasReport: !!summaryMd,
			bbox:
				minLng === null || minLat === null || maxLng === null || maxLat === null
					? null
					: ([minLng, minLat, maxLng, maxLat] as [number, number, number, number])
		}));
}

export type RouteThumbnail = { path: string; nights: [number, number][] };

/**
 * Small route sketches (SVG path in a `size`×`size` box, north up) for the archive list,
 * with the end of every day but the last marked as a night.
 */
export function routeThumbnails(size = 120, pad = 12): Map<string, RouteThumbnail> {
	const rows = db
		.select({ slug: tour.slug, geojson: stage.geojson })
		.from(stage)
		.innerJoin(tour, eq(tour.id, stage.tourId))
		.orderBy(tour.slug, asc(stage.dayIndex))
		.all();

	const bySlug = new Map<string, number[][][]>(); // slug → days → points
	for (const r of rows) {
		if (!r.geojson) continue;
		const day = r.geojson.coordinates.flat();
		if (day.length) bySlug.set(r.slug, [...(bySlug.get(r.slug) ?? []), day]);
	}

	const out = new Map<string, RouteThumbnail>();
	for (const [slug, days] of bySlug) {
		const all = days.flat();
		const lat0 = all.reduce((s, p) => s + p[1], 0) / all.length;
		const kx = Math.cos((lat0 * Math.PI) / 180);
		const xs = all.map((p) => p[0] * kx);
		const ys = all.map((p) => -p[1]);
		const [minX, maxX, minY, maxY] = [
			Math.min(...xs),
			Math.max(...xs),
			Math.min(...ys),
			Math.max(...ys)
		];
		const scale = (size - 2 * pad) / Math.max(maxX - minX, maxY - minY, 1e-9);
		const ox = size / 2 - (scale * (minX + maxX)) / 2;
		const oy = size / 2 - (scale * (minY + maxY)) / 2;
		const project = (p: number[]): [number, number] => [
			Math.round((ox + scale * p[0] * kx) * 10) / 10,
			Math.round((oy - scale * p[1]) * 10) / 10
		];

		// ~150 points per tour is plenty at thumbnail size.
		const step = Math.max(1, Math.floor(all.length / 150));
		const path = days
			.map((day) => {
				const pts = day.filter((_, i) => i % step === 0 || i === day.length - 1).map(project);
				return 'M' + pts.map(([x, y]) => `${x} ${y}`).join(' L');
			})
			.join(' ');
		const nights = days.slice(0, -1).map((day) => project(day[day.length - 1]));
		out.set(slug, { path, nights });
	}
	return out;
}
