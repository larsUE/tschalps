import { json } from '@sveltejs/kit';
import { isNull } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { place } from '#lib/server/db/schema.ts';
import { PLACE_TYPE_COLORS } from '#lib/labels.ts';
import type { RequestHandler } from './$types';

/** All active places as GeoJSON points for the maps. */
export const GET: RequestHandler = () => {
	const rows = db
		.select({
			id: place.id,
			name: place.name,
			type: place.type,
			status: place.status,
			lat: place.lat,
			lng: place.lng
		})
		.from(place)
		.where(isNull(place.deletedAt))
		.all();

	return json(
		{
			type: 'FeatureCollection',
			features: rows.map((p) => ({
				type: 'Feature',
				properties: {
					key: p.id,
					name: p.name,
					type: p.type,
					status: p.status,
					color: PLACE_TYPE_COLORS[p.type]
				},
				geometry: { type: 'Point', coordinates: [p.lng, p.lat] }
			}))
		},
		{ headers: { 'cache-control': 'private, no-cache' } }
	);
};
