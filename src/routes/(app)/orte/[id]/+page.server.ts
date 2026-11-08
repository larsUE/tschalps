import { error, fail } from '@sveltejs/kit';
import { and, asc, count, desc, eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { placeComment, placeRevision, stage, tour, user } from '#lib/server/db/schema.ts';
import { formText } from '#lib/server/forms.ts';
import { getPlace, restorePlace } from '#lib/server/places.ts';
import { placePhotos } from '#lib/server/photos.ts';
import { photoActions } from '#lib/server/photo-actions.ts';
import type { Actions, PageServerLoad } from './$types';

const nameOf = (id: string | null) =>
	id ? db.select({ name: user.name }).from(user).where(eq(user.id, id)).get()?.name : undefined;

export const load: PageServerLoad = ({ params, locals }) => {
	const p = getPlace(params.id);
	const isAdmin = locals.user?.role === 'admin';
	if (!p || (p.deletedAt && !isAdmin)) error(404, 'Diesen Ort gibt es nicht (mehr).');

	const comments = db
		.select({
			id: placeComment.id,
			body: placeComment.body,
			visitedOn: placeComment.visitedOn,
			createdAt: placeComment.createdAt,
			userId: placeComment.userId,
			author: user.name
		})
		.from(placeComment)
		.leftJoin(user, eq(user.id, placeComment.userId))
		.where(eq(placeComment.placeId, p.id))
		.orderBy(desc(placeComment.createdAt))
		.all()
		.map((c) => ({ ...c, canDelete: isAdmin || c.userId === locals.user?.id }));

	const nights = db
		.select({
			slug: tour.slug,
			title: tour.title,
			year: tour.year,
			dayIndex: stage.dayIndex,
			date: stage.date
		})
		.from(stage)
		.innerJoin(tour, eq(tour.id, stage.tourId))
		.where(eq(stage.nightPlaceId, p.id))
		.orderBy(desc(tour.year), asc(stage.dayIndex))
		.all();

	const revisions =
		db.select({ n: count() }).from(placeRevision).where(eq(placeRevision.placeId, p.id)).get()?.n ??
		0;

	return {
		place: {
			id: p.id,
			name: p.name,
			type: p.type,
			status: p.status,
			lat: p.lat,
			lng: p.lng,
			ele: p.ele,
			description: p.description,
			access: p.access,
			removed: !!p.deletedAt,
			createdAt: p.createdAt,
			updatedAt: p.updatedAt,
			createdBy: nameOf(p.createdBy),
			updatedBy: nameOf(p.updatedBy)
		},
		comments,
		photos: placePhotos(p.id).map((ph) => ({
			id: ph.id,
			caption: ph.caption,
			takenAt: ph.takenAt?.getTime() ?? null,
			uploader: nameOf(ph.uploadedBy),
			// Uploaders and admins may caption and delete a photo.
			manage: isAdmin || ph.uploadedBy === locals.user?.id
		})),
		nights,
		revisions,
		isAdmin
	};
};

export const actions: Actions = {
	...photoActions(
		(params) => ({ kind: 'place', id: params.id }),
		(photo, locals) => locals.user?.role === 'admin' || photo.uploadedBy === locals.user?.id
	),
	comment: async ({ request, params, locals }) => {
		const p = getPlace(params.id);
		if (!p || p.deletedAt) error(404, 'Diesen Ort gibt es nicht (mehr).');
		const form = await request.formData();
		const body = formText(form, 'body');
		const visitedOn = formText(form, 'visitedOn') || null;

		if (!body) return fail(400, { body, visitedOn, error: 'Bitte schreib etwas.' });
		if (body.length > 5000)
			return fail(400, { body, visitedOn, error: 'Der Beitrag ist zu lang.' });
		if (visitedOn && !/^\d{4}-\d{2}-\d{2}$/.test(visitedOn)) {
			return fail(400, { body, visitedOn, error: 'Ungültiges Datum.' });
		}

		db.insert(placeComment)
			.values({ placeId: p.id, userId: locals.user!.id, body, visitedOn })
			.run();
		return { commented: true };
	},

	deleteComment: async ({ request, params, locals }) => {
		const id = String((await request.formData()).get('id') ?? '');
		const c = db
			.select({ userId: placeComment.userId })
			.from(placeComment)
			.where(and(eq(placeComment.id, id), eq(placeComment.placeId, params.id)))
			.get();
		if (!c) return fail(404, { error: 'Beitrag nicht gefunden.' });
		if (c.userId !== locals.user!.id && locals.user!.role !== 'admin') {
			return fail(403, { error: 'Nur eigene Beiträge können gelöscht werden.' });
		}
		db.delete(placeComment).where(eq(placeComment.id, id)).run();
	},

	restore: async ({ params, locals }) => {
		if (locals.user!.role !== 'admin') error(403, 'Nur Admins können Orte wiederherstellen.');
		restorePlace(params.id, locals.user!.id);
	}
};
