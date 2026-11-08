import { error } from '@sveltejs/kit';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { place, stage, tour, tourParticipant, user } from '#lib/server/db/schema.ts';
import { canEditTour } from '#lib/server/tours.ts';
import { renderMarkdown } from '#lib/server/markdown.ts';
import { MAX_TOUR_PHOTOS, tourPhotos } from '#lib/server/photos.ts';
import { photoActions } from '#lib/server/photo-actions.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, locals }) => {
	const t = db.select().from(tour).where(eq(tour.slug, params.slug)).get();
	if (!t) error(404, 'Diese Tschalps gibt es nicht.');

	const stages = db
		.select({
			id: stage.id,
			dayIndex: stage.dayIndex,
			date: stage.date,
			title: stage.title,
			geojson: stage.geojson,
			minLng: stage.minLng,
			minLat: stage.minLat,
			maxLng: stage.maxLng,
			maxLat: stage.maxLat,
			distanceM: stage.distanceM,
			ascentM: stage.ascentM,
			descentM: stage.descentM,
			minEle: stage.minEle,
			maxEle: stage.maxEle,
			reportMd: stage.reportMd,
			difficulty: stage.difficulty,
			trailMix: stage.trailMix,
			nightPlaceId: place.id,
			nightPlaceName: place.name
		})
		.from(stage)
		// Removed places are not shown as a night's place.
		.leftJoin(place, and(eq(place.id, stage.nightPlaceId), isNull(place.deletedAt)))
		.where(eq(stage.tourId, t.id))
		.orderBy(asc(stage.dayIndex))
		.all();

	const participants = db
		.select({ name: user.name })
		.from(tourParticipant)
		.innerJoin(user, eq(user.id, tourParticipant.userId))
		.where(eq(tourParticipant.tourId, t.id))
		.orderBy(asc(user.name))
		.all()
		.map((p) => p.name);

	const creator = t.createdBy
		? db.select({ name: user.name }).from(user).where(eq(user.id, t.createdBy)).get()?.name
		: undefined;

	return {
		tour: {
			slug: t.slug,
			title: t.title,
			year: t.year,
			season: t.season,
			startDate: t.startDate,
			endDate: t.endDate,
			kind: t.kind,
			huts: t.huts,
			summaryHtml: renderMarkdown(t.summaryMd)
		},
		stages: stages.map(({ reportMd, ...s }) => ({ ...s, reportHtml: renderMarkdown(reportMd) })),
		participants,
		creator,
		photos: tourPhotos(t.id).map((p) => ({
			id: p.id,
			caption: p.caption,
			lat: p.lat,
			lng: p.lng,
			stageId: p.stageId,
			takenAt: p.takenAt?.getTime() ?? null,
			dayIndex: stages.find((s) => s.id === p.stageId)?.dayIndex ?? null
		})),
		maxPhotos: MAX_TOUR_PHOTOS,
		canEdit: canEditTour(locals.user!, t)
	};
};

const tourBySlug = (slug: string) => {
	const t = db.select().from(tour).where(eq(tour.slug, slug)).get();
	if (!t) error(404, 'Diese Tschalps gibt es nicht.');
	return t;
};

export const actions: Actions = photoActions(
	(params) => ({ kind: 'tour', id: tourBySlug(params.slug).id }),
	(_photo, locals, params) => canEditTour(locals.user!, tourBySlug(params.slug))
);
