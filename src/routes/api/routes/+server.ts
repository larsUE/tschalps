import { json } from '@sveltejs/kit';
import { eq, isNotNull } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { stage, tour } from '#lib/server/db/schema.ts';
import type { RequestHandler } from './$types';

/** All stage lines for the overview map, as GeoJSON. */
export const GET: RequestHandler = () => {
	const rows = db
		.select({
			stageId: stage.id,
			dayIndex: stage.dayIndex,
			geojson: stage.geojson,
			slug: tour.slug,
			title: tour.title,
			year: tour.year
		})
		.from(stage)
		.innerJoin(tour, eq(tour.id, stage.tourId))
		.where(isNotNull(stage.geojson))
		.all();

	return json(
		{
			type: 'FeatureCollection',
			features: rows.map((r) => ({
				type: 'Feature',
				properties: {
					key: r.slug, // hovering highlights the whole tour
					stageId: r.stageId,
					dayIndex: r.dayIndex,
					slug: r.slug,
					title: r.title,
					year: r.year
				},
				geometry: r.geojson
			}))
		},
		{ headers: { 'cache-control': 'private, no-cache' } }
	);
};
