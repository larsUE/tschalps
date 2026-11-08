import { and, asc, inArray, isNull } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { PLACE_TYPES, place } from '#lib/server/db/schema.ts';
import { toWaypointsGpx } from '#lib/server/gpx.ts';
import { PLACE_STATUS_LABELS, PLACE_TYPE_LABELS } from '#lib/labels.ts';
import type { RequestHandler } from './$types';

/**
 * Active places as GPX waypoints. Optional filters:
 * ?typ=stall,scheune  and  ?bbox=minLng,minLat,maxLng,maxLat (the visible map area).
 */
export const GET: RequestHandler = ({ url }) => {
	const types = (url.searchParams.get('typ') ?? '')
		.split(',')
		.filter((t): t is (typeof PLACE_TYPES)[number] => PLACE_TYPES.includes(t as never));
	const bbox = (url.searchParams.get('bbox') ?? '').split(',').map(Number);
	const inBox =
		bbox.length === 4 && bbox.every(Number.isFinite)
			? (p: { lat: number; lng: number }) =>
					p.lng >= bbox[0] && p.lat >= bbox[1] && p.lng <= bbox[2] && p.lat <= bbox[3]
			: () => true;

	const places = db
		.select()
		.from(place)
		.where(and(isNull(place.deletedAt), types.length ? inArray(place.type, types) : undefined))
		.orderBy(asc(place.name))
		.all()
		.filter(inBox);

	const gpx = toWaypointsGpx(
		'Tschalps – Orte',
		places.map((p) => ({
			name: p.name,
			lat: p.lat,
			lng: p.lng,
			ele: p.ele,
			type: PLACE_TYPE_LABELS[p.type],
			description:
				[
					p.status !== 'aktiv' ? PLACE_STATUS_LABELS[p.status] : null,
					p.description,
					p.access && `Zugang: ${p.access}`
				]
					.filter(Boolean)
					.join('\n') || null
		}))
	);

	return new Response(gpx, {
		headers: {
			'content-type': 'application/gpx+xml',
			'content-disposition': 'attachment; filename="tschalps-orte.gpx"',
			'cache-control': 'private, no-cache'
		}
	});
};
