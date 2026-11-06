import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { UPLOAD_DIR } from '$app/env/private';

const root = resolve(UPLOAD_DIR);

/** Absolute path of an upload; refuses paths that would escape UPLOAD_DIR. */
export function uploadPath(relative: string) {
	const path = resolve(root, relative);
	if (!path.startsWith(root + sep)) throw new Error(`Invalid upload path: ${relative}`);
	return path;
}

export async function writeUpload(relative: string, data: string | Uint8Array) {
	const path = uploadPath(relative);
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, data);
}

export const readUpload = (relative: string) => readFile(uploadPath(relative));

export const removeUpload = (relative: string) =>
	rm(uploadPath(relative), { recursive: true, force: true });
