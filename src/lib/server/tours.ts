import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { stage, tour, tourParticipant, SEASONS } from '#lib/server/db/schema.ts';
import type { SessionUser } from '#lib/server/auth.ts';
import {
	GpxError,
	parseGpx,
	splitIntoStages,
	stageMetrics,
	toGpx,
	type StageDraft
} from './gpx.ts';
import { writeUpload } from './storage.ts';

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
	summaryMd: string | null;
};

/** Validates the tour metadata fields. Returns field values (for re-filling the form) and errors. */
export function readTourFields(form: FormData) {
	const str = (key: string) => String(form.get(key) ?? '').trim();
	const values = {
		title: str('title'),
		year: str('year'),
		season: str('season'),
		startDate: str('startDate'),
		endDate: str('endDate'),
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

/** Stores stage files and rows for parsed uploads, then renumbers the tour's days. */
export async function saveStages(tourId: string, upload: ParsedUpload) {
	const rows: (typeof stage.$inferInsert)[] = [];
	for (const draft of upload.stages) {
		const id = crypto.randomUUID();
		const gpxPath = `gpx/${tourId}/${id}.gpx`;
		// Keep the original file when it maps 1:1 to this stage; otherwise write the day's part.
		const content =
			draft.wholeFileIndex !== undefined
				? upload.files[draft.wholeFileIndex].bytes
				: toGpx(draft.title ?? 'Etappe', [{ name: draft.title, segments: draft.segments }]);
		await writeUpload(gpxPath, content);

		rows.push({
			id,
			tourId,
			dayIndex: 0, // set by renumberStages
			date: draft.date ?? null,
			title: draft.title ?? null,
			gpxPath,
			...stageMetrics(draft.segments)
		});
	}

	db.transaction((tx) => {
		if (rows.length) tx.insert(stage).values(rows).run();
		renumberStages(tourId, tx);
	});
	return rows.length;
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
