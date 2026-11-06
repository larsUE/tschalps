import { error } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { stage, tour, tourParticipant, user } from '#lib/server/db/schema.ts';
import { canEditTour } from '#lib/server/tours.ts';
import type { PageServerLoad } from './$types';

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
			maxEle: stage.maxEle
		})
		.from(stage)
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
			summaryMd: t.summaryMd
		},
		stages,
		participants,
		creator,
		canEdit: canEditTour(locals.user!, t)
	};
};
