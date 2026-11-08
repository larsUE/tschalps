import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { tour } from '#lib/server/db/schema.ts';
import { addTourPhoto } from '#lib/server/photos.ts';
import { canEditTour } from '#lib/server/tours.ts';
import { handlePhotoUpload } from '#lib/server/photo-upload.ts';
import type { RequestHandler } from './$types';

/** Adds one photo to a tour (creator, participants and admins). */
export const POST: RequestHandler = async ({ request, params, locals }) => {
	const t = db.select().from(tour).where(eq(tour.slug, params.slug)).get();
	if (!t) error(404, 'Tschalps nicht gefunden');
	if (!canEditTour(locals.user!, t)) error(403, 'Keine Berechtigung');
	return handlePhotoUpload(request, (bytes) => addTourPhoto(t.id, bytes, locals.user!.id));
};
