import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { tour } from '#lib/server/db/schema.ts';
import { GpxError, parseGpx, toGpx, type GpxTrack } from '#lib/server/gpx.ts';
import { readUpload } from '#lib/server/storage.ts';
import { stagesOf } from '#lib/server/tours.ts';
import type { RequestHandler } from './$types';

/** All stages of a tour merged into one GPX, one track per day. */
export const GET: RequestHandler = async ({ params }) => {
	const t = db.select().from(tour).where(eq(tour.slug, params.slug)).get();
	if (!t) error(404, 'Tschalps nicht gefunden');

	const tracks: GpxTrack[] = [];
	for (const s of stagesOf(t.id)) {
		if (!s.gpxPath) continue;
		try {
			const file = parseGpx((await readUpload(s.gpxPath)).toString('utf8'));
			tracks.push({
				name: [`Tag ${s.dayIndex}`, s.title].filter(Boolean).join(': '),
				segments: file.tracks.flatMap((track) => track.segments)
			});
		} catch (e) {
			// A missing or unreadable day shouldn't block the rest of the download.
			if (!(e instanceof GpxError) && (e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
		}
	}
	if (!tracks.length) error(404, 'Keine GPX-Daten vorhanden');

	return new Response(toGpx(`${t.title} (${t.year})`, tracks), {
		headers: {
			'content-type': 'application/gpx+xml',
			'content-disposition': `attachment; filename="${t.slug}.gpx"`,
			'cache-control': 'private, no-cache'
		}
	});
};
