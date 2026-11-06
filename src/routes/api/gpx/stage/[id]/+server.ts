import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { stage, tour } from '#lib/server/db/schema.ts';
import { readUpload } from '#lib/server/storage.ts';
import type { RequestHandler } from './$types';

/** Original (or per-day) GPX file of one stage. */
export const GET: RequestHandler = async ({ params }) => {
	const row = db
		.select({ gpxPath: stage.gpxPath, dayIndex: stage.dayIndex, slug: tour.slug })
		.from(stage)
		.innerJoin(tour, eq(tour.id, stage.tourId))
		.where(eq(stage.id, params.id))
		.get();
	if (!row?.gpxPath) error(404, 'GPX nicht gefunden');

	let body;
	try {
		body = await readUpload(row.gpxPath);
	} catch {
		error(404, 'GPX-Datei fehlt');
	}

	return new Response(new Uint8Array(body), {
		headers: {
			'content-type': 'application/gpx+xml',
			'content-disposition': `attachment; filename="${row.slug}-tag-${row.dayIndex}.gpx"`,
			'cache-control': 'private, no-cache'
		}
	});
};
