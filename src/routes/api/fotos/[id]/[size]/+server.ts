import { error } from '@sveltejs/kit';
import { findPhoto, readPhoto } from '#lib/server/photos.ts';
import type { RequestHandler } from './$types';

/**
 * Photo delivery (members only, see hooks.server.ts). A photo's files never change
 * under the same id, so browsers may cache them for good.
 */
export const GET: RequestHandler = async ({ params }) => {
	if (params.size !== 'gross' && params.size !== 'klein') error(404, 'Unbekannte Grösse');
	const photo = findPhoto(params.id);
	if (!photo) error(404, 'Foto nicht gefunden');

	let body;
	try {
		body = await readPhoto(photo.path, params.size);
	} catch {
		error(404, 'Fotodatei fehlt');
	}
	return new Response(new Uint8Array(body), {
		headers: {
			'content-type': 'image/webp',
			'cache-control': 'private, max-age=31536000, immutable'
		}
	});
};
