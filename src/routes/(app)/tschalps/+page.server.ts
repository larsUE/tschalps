import { desc, eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { stage, tour } from '#lib/server/db/schema.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const tours = db
		.select({
			slug: tour.slug,
			title: tour.title,
			year: tour.year,
			season: tour.season,
			startDate: tour.startDate,
			endDate: tour.endDate,
			days: sql<number>`count(${stage.id})`,
			distanceM: sql<number | null>`sum(${stage.distanceM})`,
			ascentM: sql<number | null>`sum(${stage.ascentM})`
		})
		.from(tour)
		.leftJoin(stage, eq(stage.tourId, tour.id))
		.groupBy(tour.id)
		.orderBy(desc(tour.year), desc(tour.startDate), tour.title)
		.all();

	return { tours };
};
