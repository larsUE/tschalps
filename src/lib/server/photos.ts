import { and, asc, count, eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { placePhoto, stage, tourPhoto } from '#lib/server/db/schema.ts';
import { PhotoError, processPhoto } from './images.ts';
import { readUpload, removeUpload, writeUpload } from './storage.ts';

/** A tour shows a small selection; places can collect any number of photos. */
export const MAX_TOUR_PHOTOS = 10;

export type PhotoSize = 'gross' | 'klein';

const fileOf = (base: string, size: PhotoSize) =>
	size === 'gross' ? `${base}.webp` : `${base}-thumb.webp`;

async function store(dir: string, bytes: Uint8Array) {
	const processed = await processPhoto(bytes);
	const id = crypto.randomUUID();
	const path = `${dir}/${id}`;
	await writeUpload(fileOf(path, 'gross'), processed.large);
	await writeUpload(fileOf(path, 'klein'), processed.thumb);
	return { id, path, processed };
}

export const tourPhotoCount = (tourId: string) =>
	db.select({ n: count() }).from(tourPhoto).where(eq(tourPhoto.tourId, tourId)).get()?.n ?? 0;

export async function addTourPhoto(tourId: string, bytes: Uint8Array, userId: string) {
	if (tourPhotoCount(tourId) >= MAX_TOUR_PHOTOS) {
		throw new PhotoError(`Pro Tschalps sind höchstens ${MAX_TOUR_PHOTOS} Fotos möglich.`);
	}
	const { id, path, processed: p } = await store(`photos/tours/${tourId}`, bytes);
	// Attach the photo to the day it was taken, when the tour has a stage on that date.
	const day = p.takenOn
		? db
				.select({ id: stage.id })
				.from(stage)
				.where(and(eq(stage.tourId, tourId), eq(stage.date, p.takenOn)))
				.get()
		: undefined;
	db.insert(tourPhoto)
		.values({
			id,
			tourId,
			stageId: day?.id ?? null,
			path,
			lat: p.lat,
			lng: p.lng,
			takenAt: p.takenAt === null ? null : new Date(p.takenAt),
			uploadedBy: userId
		})
		.run();
	return id;
}

export async function addPlacePhoto(placeId: string, bytes: Uint8Array, userId: string) {
	const { id, path, processed: p } = await store(`photos/places/${placeId}`, bytes);
	db.insert(placePhoto)
		.values({
			id,
			placeId,
			path,
			takenAt: p.takenAt === null ? null : new Date(p.takenAt),
			uploadedBy: userId
		})
		.run();
	return id;
}

/** Finds a photo of either kind by id. */
export function findPhoto(id: string) {
	const t = db.select().from(tourPhoto).where(eq(tourPhoto.id, id)).get();
	if (t) return { kind: 'tour' as const, ...t };
	const p = db.select().from(placePhoto).where(eq(placePhoto.id, id)).get();
	if (p) return { kind: 'place' as const, ...p };
	return null;
}

export const readPhoto = (path: string, size: PhotoSize) => readUpload(fileOf(path, size));

export async function deletePhoto(photo: NonNullable<ReturnType<typeof findPhoto>>) {
	if (photo.kind === 'tour') db.delete(tourPhoto).where(eq(tourPhoto.id, photo.id)).run();
	else db.delete(placePhoto).where(eq(placePhoto.id, photo.id)).run();
	await removeUpload(fileOf(photo.path, 'gross'));
	await removeUpload(fileOf(photo.path, 'klein'));
}

export function setCaption(
	photo: NonNullable<ReturnType<typeof findPhoto>>,
	caption: string | null
) {
	const table = photo.kind === 'tour' ? tourPhoto : placePhoto;
	db.update(table).set({ caption }).where(eq(table.id, photo.id)).run();
}

// Lists for pages ---------------------------------------------------------------

export const tourPhotos = (tourId: string) =>
	db
		.select({
			id: tourPhoto.id,
			caption: tourPhoto.caption,
			lat: tourPhoto.lat,
			lng: tourPhoto.lng,
			takenAt: tourPhoto.takenAt,
			stageId: tourPhoto.stageId,
			uploadedBy: tourPhoto.uploadedBy
		})
		.from(tourPhoto)
		.where(eq(tourPhoto.tourId, tourId))
		// By time taken; photos without a date go last.
		.orderBy(
			asc(sql`${tourPhoto.takenAt} is null`),
			asc(tourPhoto.takenAt),
			asc(tourPhoto.createdAt)
		)
		.all();

export const placePhotos = (placeId: string) =>
	db
		.select({
			id: placePhoto.id,
			caption: placePhoto.caption,
			takenAt: placePhoto.takenAt,
			uploadedBy: placePhoto.uploadedBy
		})
		.from(placePhoto)
		.where(eq(placePhoto.placeId, placeId))
		.orderBy(asc(placePhoto.createdAt))
		.all();
