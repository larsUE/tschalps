import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { resolve } from '$app/paths';
import { db } from '#lib/server/db/index.ts';
import { stage, tour } from '#lib/server/db/schema.ts';
import { createPlace, placesNear, readPlaceFields } from '#lib/server/places.ts';
import { canEditTour } from '#lib/server/tours.ts';
import type { SessionUser } from '#lib/server/auth.ts';
import type { Actions, PageServerLoad } from './$types';

/** A tour day whose night this new place should become (when the user may edit that tour). */
function linkableStage(stageId: string | null, user: SessionUser) {
	if (!stageId) return null;
	const row = db
		.select({
			id: stage.id,
			dayIndex: stage.dayIndex,
			tourId: tour.id,
			slug: tour.slug,
			title: tour.title,
			createdBy: tour.createdBy
		})
		.from(stage)
		.innerJoin(tour, eq(tour.id, stage.tourId))
		.where(eq(stage.id, stageId))
		.get();
	return row && canEditTour(user, { id: row.tourId, createdBy: row.createdBy }) ? row : null;
}

export const load: PageServerLoad = ({ url, locals }) => {
	const s = linkableStage(url.searchParams.get('etappe'), locals.user!);
	return {
		values: { lat: url.searchParams.get('lat'), lng: url.searchParams.get('lng') },
		stage: s && { id: s.id, dayIndex: s.dayIndex, title: s.title }
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const user = locals.user!;
		const form = await request.formData();
		const { values, fields, errors } = readPlaceFields(form);
		if (errors.length) return fail(400, { values, errors });

		// Warn about likely duplicates once; a second submit with the box ticked goes through.
		if (!form.get('confirmNearby')) {
			const nearby = placesNear(fields.lat, fields.lng, 100, 5);
			if (nearby.length) {
				return fail(409, {
					values,
					nearby: nearby.map((p) => ({
						id: p.id,
						name: p.name,
						distanceM: Math.round(p.distanceM)
					}))
				});
			}
		}

		const id = await createPlace(fields, user.id);

		const s = linkableStage(String(form.get('stageId') ?? '') || null, user);
		if (s) {
			db.update(stage).set({ nightPlaceId: id }).where(eq(stage.id, s.id)).run();
			redirect(303, resolve('/(app)/tschalps/[slug]/bearbeiten', { slug: s.slug }));
		}
		redirect(303, resolve('/(app)/orte/[id]', { id }));
	}
};
