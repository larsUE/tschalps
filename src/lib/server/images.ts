import exifr from 'exifr';
import sharp from 'sharp';

/** Below BODY_SIZE_LIMIT (25M) so a photo plus form overhead fits in one request. */
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
const LARGE_PX = 2000;
const THUMB_PX = 480;
const ACCEPTED = new Set(['jpeg', 'png', 'webp', 'heif', 'tiff']);

export class PhotoError extends Error {}

export type ProcessedPhoto = {
	large: Buffer;
	thumb: Buffer;
	width: number;
	height: number;
	lat: number | null;
	lng: number | null;
	/** UTC milliseconds. */
	takenAt: number | null;
	/** Local calendar day the photo was taken (YYYY-MM-DD), for matching tour days. */
	takenOn: string | null;
};

/** Offset of Europe/Zurich from UTC at a given instant, in ms. */
function zurichOffset(utcMs: number) {
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat('en-US', {
			timeZone: 'Europe/Zurich',
			hourCycle: 'h23',
			year: 'numeric',
			month: 'numeric',
			day: 'numeric',
			hour: 'numeric',
			minute: 'numeric',
			second: 'numeric'
		})
			.formatToParts(utcMs)
			.map((p) => [p.type, Number(p.value)])
	);
	const asUtc = Date.UTC(
		parts.year,
		parts.month - 1,
		parts.day,
		parts.hour,
		parts.minute,
		parts.second
	);
	return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/**
 * Camera timestamps ("2024:07:08 10:15:00") carry no time zone. Use the recorded offset
 * when there is one, otherwise read them as Swiss local time.
 */
export function parseExifTime(
	raw: unknown,
	offset?: unknown
): { takenAt: number; takenOn: string } | null {
	const m =
		typeof raw === 'string' && raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
	if (!m) return null;
	const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
	if (y < 1990 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
	const wall = Date.UTC(y, mo - 1, d, h, mi, s);
	let takenAt: number;
	const off = typeof offset === 'string' && offset.match(/^([+-])(\d{2}):(\d{2})$/);
	if (off) {
		takenAt = wall - (off[1] === '-' ? -1 : 1) * (Number(off[2]) * 60 + Number(off[3])) * 60_000;
	} else {
		// Two passes settle the offset around daylight-saving changes.
		takenAt = wall - zurichOffset(wall);
		takenAt = wall - zurichOffset(takenAt);
	}
	return { takenAt, takenOn: `${m[1]}-${m[2]}-${m[3]}` };
}

/**
 * Reads position and time from the photo, then produces a large and a thumbnail WebP.
 * Output carries no metadata (camera, serial numbers, GPS): position and time live in the database.
 */
export async function processPhoto(bytes: Uint8Array): Promise<ProcessedPhoto> {
	let format: string | undefined;
	try {
		format = (await sharp(bytes).metadata()).format;
	} catch {
		throw new PhotoError('Die Datei ist kein lesbares Bild.');
	}
	if (!format || !ACCEPTED.has(format)) {
		throw new PhotoError('Nur JPEG-, PNG- und WebP-Bilder sind möglich.');
	}

	let lat: number | null = null;
	let lng: number | null = null;
	let time: ReturnType<typeof parseExifTime> = null;
	try {
		const exif = await exifr.parse(bytes, {
			gps: true,
			reviveValues: false,
			pick: [
				'DateTimeOriginal',
				'OffsetTimeOriginal',
				'CreateDate',
				'GPSLatitude',
				'GPSLatitudeRef',
				'GPSLongitude',
				'GPSLongitudeRef'
			]
		});
		if (exif) {
			if (Number.isFinite(exif.latitude) && Number.isFinite(exif.longitude)) {
				lat = exif.latitude;
				lng = exif.longitude;
			}
			time = parseExifTime(exif.DateTimeOriginal ?? exif.CreateDate, exif.OffsetTimeOriginal);
		}
	} catch {
		// Missing or broken EXIF is fine: the photo just has no position or time.
	}

	try {
		// rotate() applies the EXIF orientation before the metadata is dropped.
		const base = sharp(bytes).rotate();
		const large = await base
			.clone()
			.resize(LARGE_PX, LARGE_PX, { fit: 'inside', withoutEnlargement: true })
			.webp({ quality: 82 })
			.toBuffer({ resolveWithObject: true });
		const thumb = await base
			.clone()
			.resize(THUMB_PX, THUMB_PX, { fit: 'inside', withoutEnlargement: true })
			.webp({ quality: 75 })
			.toBuffer();
		return {
			large: large.data,
			thumb,
			width: large.info.width,
			height: large.info.height,
			lat,
			lng,
			takenAt: time?.takenAt ?? null,
			takenOn: time?.takenOn ?? null
		};
	} catch {
		throw new PhotoError(
			format === 'heif'
				? 'HEIC-Fotos können nicht gelesen werden. Bitte als JPEG exportieren (iPhone: Einstellungen › Kamera › Formate › «Maximale Kompatibilität»).'
				: 'Das Bild konnte nicht verarbeitet werden.'
		);
	}
}
