import { error } from '@sveltejs/kit';
import { getPlace } from '#lib/server/places.ts';
import { addPlacePhoto } from '#lib/server/photos.ts';
import { handlePhotoUpload } from '#lib/server/photo-upload.ts';
import type { RequestHandler } from './$types';

/** Adds one photo to a place (any member). */
export const POST: RequestHandler = async ({ request, params, locals }) => {
	const p = getPlace(params.id);
	if (!p || p.deletedAt) error(404, 'Ort nicht gefunden');
	return handlePhotoUpload(request, (bytes) => addPlacePhoto(p.id, bytes, locals.user!.id));
};
