import { error, json } from '@sveltejs/kit';
import { PhotoError, MAX_PHOTO_BYTES } from './images.ts';

/**
 * Shared handling for single-photo uploads: the browser sends one file per request,
 * so each request stays well under the server's body size limit.
 */
export async function handlePhotoUpload(
	request: Request,
	save: (bytes: Uint8Array) => Promise<string>
) {
	const form = await request.formData();
	const file = form.get('file');
	if (!(file instanceof File) || file.size === 0) error(400, 'Keine Datei erhalten.');
	if (file.size > MAX_PHOTO_BYTES) {
		return json({ error: `${file.name}: grösser als 20 MB.` }, { status: 400 });
	}
	try {
		const id = await save(new Uint8Array(await file.arrayBuffer()));
		return json({ id });
	} catch (e) {
		if (e instanceof PhotoError)
			return json({ error: `${file.name}: ${e.message}` }, { status: 400 });
		throw e;
	}
}
