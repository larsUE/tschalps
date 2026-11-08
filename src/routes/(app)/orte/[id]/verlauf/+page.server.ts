import { error, fail, redirect } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { resolve } from '$app/paths';
import { db } from '#lib/server/db/index.ts';
import { placeRevision, user } from '#lib/server/db/schema.ts';
import { getPlace, revertPlace, type PlaceSnapshot } from '#lib/server/places.ts';
import type { Actions, PageServerLoad } from './$types';

const FIELD_LABELS: Record<string, string> = {
	name: 'Name',
	type: 'Art',
	lat: 'Lage',
	lng: 'Lage',
	ele: 'Höhe',
	description: 'Beschreibung',
	access: 'Zugang',
	status: 'Status',
	deletedAt: 'Sichtbarkeit'
};

export const load: PageServerLoad = ({ params, locals }) => {
	const p = getPlace(params.id);
	const isAdmin = locals.user?.role === 'admin';
	if (!p || (p.deletedAt && !isAdmin)) error(404, 'Diesen Ort gibt es nicht (mehr).');

	const rows = db
		.select({
			id: placeRevision.id,
			action: placeRevision.action,
			snapshot: placeRevision.snapshot,
			createdAt: placeRevision.createdAt,
			author: user.name
		})
		.from(placeRevision)
		.leftJoin(user, eq(user.id, placeRevision.userId))
		.where(eq(placeRevision.placeId, p.id))
		.orderBy(asc(placeRevision.createdAt))
		.all();

	// Which fields each revision changed compared to the one before it.
	const revisions = rows.map((r, i) => {
		const s = r.snapshot as PlaceSnapshot;
		const prev = i ? (rows[i - 1].snapshot as PlaceSnapshot) : null;
		const changed = prev
			? [
					...new Set(
						(Object.keys(FIELD_LABELS) as (keyof PlaceSnapshot)[])
							.filter((k) => s[k] !== prev[k])
							.map((k) => FIELD_LABELS[k])
					)
				]
			: [];
		return {
			id: r.id,
			action: r.action,
			author: r.author,
			createdAt: r.createdAt,
			note: s.note,
			changed,
			snapshot: s,
			isCurrent: i === rows.length - 1
		};
	});

	return { place: { id: p.id, name: p.name }, revisions: revisions.reverse(), isAdmin };
};

export const actions: Actions = {
	revert: async ({ request, params, locals }) => {
		if (locals.user!.role !== 'admin') error(403, 'Nur Admins können Änderungen zurücksetzen.');
		const revisionId = String((await request.formData()).get('revision') ?? '');
		const placeId = revertPlace(revisionId, locals.user!.id);
		if (placeId !== params.id) return fail(404, { error: 'Version nicht gefunden.' });
		redirect(303, resolve('/(app)/orte/[id]', { id: params.id }));
	}
};
