import { error, fail, redirect } from '@sveltejs/kit';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { resolve } from '$app/paths';
import { db } from '#lib/server/db/index.ts';
import {
	DIFFICULTIES,
	place,
	stage,
	stagePlace,
	tour,
	tourParticipant,
	user
} from '#lib/server/db/schema.ts';
import { getPlace, placesAlong, placesNear } from '#lib/server/places.ts';
import { pointAlongRoute } from '#lib/geo.ts';
import { formText } from '#lib/server/forms.ts';
import { removeUpload } from '#lib/server/storage.ts';
import {
	canEditTour,
	parseGpxUploads,
	readTourFields,
	recomputeTrailMix,
	renumberStages,
	saveStages,
	setParticipants,
	stagesOf,
	stopsOf,
	uniqueSlug
} from '#lib/server/tours.ts';
import type { SessionUser } from '#lib/server/auth.ts';
import type { Actions, PageServerLoad } from './$types';

/** Places within this distance of a day's end are offered as that night's place. */
const NIGHT_RADIUS_M = 3000;
/** Places within this distance of a day's route are offered as places passed that day. */
const STOP_RADIUS_M = 1000;
/** Longest note on a place passed («gebadet», «Mittagsrast» …). */
const MAX_STOP_NOTE = 80;

function editableTour(slug: string, sessionUser: SessionUser | undefined) {
	const t = db.select().from(tour).where(eq(tour.slug, slug)).get();
	if (!t) error(404, 'Diese Tschalps gibt es nicht.');
	if (!sessionUser || !canEditTour(sessionUser, t)) {
		error(
			403,
			'Nur Teilnehmende, die erfassende Person und Admins können diese Tschalps bearbeiten.'
		);
	}
	return t;
}

export const load: PageServerLoad = ({ params, locals }) => {
	const t = editableTour(params.slug, locals.user);

	const participantIds = new Set(
		db
			.select({ userId: tourParticipant.userId })
			.from(tourParticipant)
			.where(eq(tourParticipant.tourId, t.id))
			.all()
			.map((p) => p.userId)
	);
	const members = db
		.select({ id: user.id, name: user.name, banned: user.banned })
		.from(user)
		.orderBy(asc(user.name))
		.all()
		.filter((m) => !m.banned || participantIds.has(m.id))
		.map((m) => ({ id: m.id, name: m.name, participant: participantIds.has(m.id) }));

	const stages = stagesOf(t.id);
	const stops = stopsOf(stages);

	return {
		tour: {
			slug: t.slug,
			title: t.title,
			year: t.year,
			season: t.season,
			startDate: t.startDate,
			endDate: t.endDate,
			kind: t.kind,
			status: t.status,
			huts: t.huts,
			summaryMd: t.summaryMd
		},
		stages: stages.map((s) => {
			// Where the day ends: suggest places to sleep nearby.
			const last = s.geojson?.coordinates.at(-1)?.at(-1);
			const end = last ? { lng: last[0], lat: last[1] } : null;
			const nearby = end ? placesNear(end.lat, end.lng, NIGHT_RADIUS_M) : [];
			const linked = s.nightPlaceId ? getPlace(s.nightPlaceId) : undefined;
			const options = nearby.map((p) => ({ id: p.id, name: p.name, distanceM: p.distanceM }));
			if (linked && !options.some((o) => o.id === linked.id)) {
				options.unshift({ id: linked.id, name: linked.name, distanceM: NaN });
			}
			// Places passed that day, and places along the route that could be added.
			const stageStops = stops.get(s.id) ?? [];
			const linkedStops = new Set(stageStops.map((x) => x.placeId));
			const bbox =
				s.minLng != null && s.minLat != null && s.maxLng != null && s.maxLat != null
					? ([s.minLng, s.minLat, s.maxLng, s.maxLat] as [number, number, number, number])
					: null;
			const stopOptions =
				s.geojson && bbox
					? placesAlong(s.geojson, bbox, STOP_RADIUS_M)
							.filter((p) => !linkedStops.has(p.id))
							.map((p) => ({ id: p.id, name: p.name, type: p.type, offM: p.offM }))
					: [];
			return {
				id: s.id,
				dayIndex: s.dayIndex,
				date: s.date,
				title: s.title,
				distanceM: s.distanceM,
				ascentM: s.ascentM,
				difficulty: s.difficulty,
				trailMix: s.trailMix,
				nightPlaceId: s.nightPlaceId,
				reportMd: s.reportMd,
				end,
				nightOptions: options,
				stops: stageStops,
				stopOptions
			};
		}),
		members
	};
};

/** Saves a day's entries from the stage form. Returns a failure, or null on success. */
function saveStage(tourId: string, form: FormData) {
	const id = String(form.get('id') ?? '');
	const own = db
		.select({ id: stage.id })
		.from(stage)
		.where(and(eq(stage.id, id), eq(stage.tourId, tourId)))
		.get();
	if (!own) return fail(404, { action: 'stages', errors: ['Etappe nicht gefunden.'] });
	const title =
		String(form.get('title') ?? '')
			.trim()
			.slice(0, 120) || null;
	const date = String(form.get('date') ?? '').trim() || null;
	if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		return fail(400, { action: 'stages', errors: ['Ungültiges Datum.'] });
	}
	const nightPlaceId = String(form.get('nightPlaceId') ?? '') || null;
	const difficulty = String(form.get('difficulty') ?? '') || null;
	if (difficulty && !DIFFICULTIES.includes(difficulty as never)) {
		return fail(400, { action: 'stages', errors: ['Ungültige Schwierigkeit.'] });
	}
	const reportMd = formText(form, 'reportMd') || null;
	if (reportMd && reportMd.length > 20_000) {
		return fail(400, { action: 'stages', errors: ['Der Tagesbericht ist zu lang.'] });
	}
	if (nightPlaceId) {
		const p = db.select({ id: place.id }).from(place).where(eq(place.id, nightPlaceId)).get();
		if (!p) return fail(400, { action: 'stages', errors: ['Diesen Ort gibt es nicht.'] });
	}
	// Notes on places passed, sent as `note:<placeId>`.
	const notes = [...form.keys()]
		.filter((k) => k.startsWith('note:'))
		.map((k) => ({ placeId: k.slice(5), note: formText(form, k).slice(0, MAX_STOP_NOTE) || null }));

	db.transaction((tx) => {
		tx.update(stage)
			.set({
				title,
				date,
				nightPlaceId,
				reportMd,
				difficulty: difficulty as (typeof DIFFICULTIES)[number] | null
			})
			.where(and(eq(stage.id, id), eq(stage.tourId, tourId)))
			.run();
		for (const { placeId, note } of notes) {
			tx.update(stagePlace)
				.set({ note })
				.where(and(eq(stagePlace.stageId, id), eq(stagePlace.placeId, placeId)))
				.run();
		}
		renumberStages(tourId, tx);
	});
	return null;
}

export const actions: Actions = {
	save: async ({ request, params, locals }) => {
		const t = editableTour(params.slug, locals.user);
		const form = await request.formData();
		const { values, fields, errors } = readTourFields(form);
		if (errors.length) return fail(400, { action: 'save', values, errors });

		// Only existing members can be participants.
		const requested = form.getAll('participants').map(String);
		const valid = requested.length
			? db
					.select({ id: user.id })
					.from(user)
					.where(inArray(user.id, requested))
					.all()
					.map((u) => u.id)
			: [];

		const slug =
			fields.title !== t.title || fields.year !== t.year
				? uniqueSlug(fields.year, fields.title, t.id)
				: t.slug;

		db.transaction((tx) => {
			tx.update(tour)
				.set({ ...fields, slug })
				.where(eq(tour.id, t.id))
				.run();
			setParticipants(t.id, valid, tx);
		});

		redirect(303, resolve('/(app)/tschalps/[slug]', { slug }));
	},

	addStages: async ({ request, params, locals }) => {
		const t = editableTour(params.slug, locals.user);
		const form = await request.formData();
		const gpx = await parseGpxUploads(form);
		if (gpx.count === 0)
			return fail(400, { action: 'addStages', errors: ['Bitte wähle mindestens eine GPX-Datei.'] });
		if (gpx.errors.length) return fail(400, { action: 'addStages', errors: gpx.errors });

		const added = await saveStages(t.id, gpx.result);
		return {
			action: 'addStages',
			message: `${added} ${added === 1 ? 'Etappe' : 'Etappen'} hinzugefügt.`
		};
	},

	updateStage: async ({ request, params, locals }) => {
		const t = editableTour(params.slug, locals.user);
		const result = saveStage(t.id, await request.formData());
		return result ?? { action: 'stages', message: 'Etappe gespeichert.' };
	},

	/** Saves the day's entries, then opens «Ort erfassen» at the day's end to add its night place. */
	newPlace: async ({ request, params, locals }) => {
		const t = editableTour(params.slug, locals.user);
		const form = await request.formData();
		const result = saveStage(t.id, form);
		if (result) return result;

		// A night's place starts at the day's end, a place passed on the way in its middle.
		const id = String(form.get('id') ?? '');
		const stop = form.get('als') === 'unterwegs';
		const geometry = stagesOf(t.id).find((s) => s.id === id)?.geojson;
		const at = geometry && pointAlongRoute(geometry, stop ? 0.5 : 1);
		if (!at) return fail(400, { action: 'stages', errors: ['Diese Etappe hat keine Route.'] });
		const query = new URLSearchParams({
			lat: at.lat.toFixed(6),
			lng: at.lng.toFixed(6),
			etappe: id,
			...(stop && { als: 'unterwegs' })
		});
		redirect(303, `${resolve('/(app)/orte/neu')}?${query}`);
	},

	/** Saves the day's entries and links the chosen place as passed that day. */
	addStop: async ({ request, params, locals }) => {
		const t = editableTour(params.slug, locals.user);
		const form = await request.formData();
		const result = saveStage(t.id, form);
		if (result) return result;

		const placeId = String(form.get('addStopId') ?? '');
		if (!placeId) return fail(400, { action: 'stages', errors: ['Bitte wähle einen Ort.'] });
		const p = db
			.select({ id: place.id })
			.from(place)
			.where(and(eq(place.id, placeId), isNull(place.deletedAt)))
			.get();
		if (!p) return fail(400, { action: 'stages', errors: ['Diesen Ort gibt es nicht.'] });
		db.insert(stagePlace)
			.values({ stageId: String(form.get('id')), placeId })
			.onConflictDoNothing()
			.run();
		return { action: 'stages', message: 'Ort hinzugefügt.' };
	},

	/** Saves the day's entries and unlinks a place passed that day. */
	removeStop: async ({ request, params, locals }) => {
		const t = editableTour(params.slug, locals.user);
		const form = await request.formData();
		const result = saveStage(t.id, form);
		if (result) return result;

		db.delete(stagePlace)
			.where(
				and(
					eq(stagePlace.stageId, String(form.get('id'))),
					eq(stagePlace.placeId, String(form.get('removeStop') ?? ''))
				)
			)
			.run();
		return { action: 'stages', message: 'Ort entfernt.' };
	},

	recomputeTrails: async ({ params, locals }) => {
		const t = editableTour(params.slug, locals.user);
		const { done, failed } = await recomputeTrailMix(t.id);
		if (failed && !done) {
			return fail(502, {
				action: 'trails',
				errors: [
					'Die Wanderwegdaten von swisstopo sind gerade nicht erreichbar. Bitte später erneut versuchen.'
				]
			});
		}
		return {
			action: 'trails',
			message: failed
				? `Wegtypen für ${done} Etappen berechnet, ${failed} fehlgeschlagen.`
				: `Wegtypen für ${done} ${done === 1 ? 'Etappe' : 'Etappen'} berechnet.`
		};
	},

	deleteStage: async ({ request, params, locals }) => {
		const t = editableTour(params.slug, locals.user);
		const id = String((await request.formData()).get('id') ?? '');
		const s = db
			.select({ gpxPath: stage.gpxPath })
			.from(stage)
			.where(and(eq(stage.id, id), eq(stage.tourId, t.id)))
			.get();
		if (!s) return fail(404, { action: 'stages', errors: ['Etappe nicht gefunden.'] });

		db.transaction((tx) => {
			tx.delete(stage).where(eq(stage.id, id)).run();
			renumberStages(t.id, tx);
		});
		if (s.gpxPath) await removeUpload(s.gpxPath);
		return { action: 'stages', message: 'Etappe gelöscht.' };
	},

	deleteTour: async ({ request, params, locals }) => {
		const t = editableTour(params.slug, locals.user);
		if ((await request.formData()).get('confirm') !== 'yes') {
			return fail(400, { action: 'deleteTour', errors: ['Bitte bestätige das Löschen.'] });
		}
		db.delete(tour).where(eq(tour.id, t.id)).run(); // stages, photos, participants cascade
		await removeUpload(`gpx/${t.id}`);
		await removeUpload(`photos/tours/${t.id}`);
		redirect(303, resolve('/(app)/tschalps'));
	}
};
