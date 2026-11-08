import { asc, count, isNotNull } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { place, placeComment, stage } from '#lib/server/db/schema.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const nights = new Map(
		db
			.select({ id: stage.nightPlaceId, n: count() })
			.from(stage)
			.where(isNotNull(stage.nightPlaceId))
			.groupBy(stage.nightPlaceId)
			.all()
			.map((r) => [r.id!, r.n])
	);
	const comments = new Map(
		db
			.select({ id: placeComment.placeId, n: count() })
			.from(placeComment)
			.groupBy(placeComment.placeId)
			.all()
			.map((r) => [r.id, r.n])
	);

	const isAdmin = locals.user?.role === 'admin';
	const rows = db
		.select({
			id: place.id,
			name: place.name,
			type: place.type,
			status: place.status,
			lat: place.lat,
			lng: place.lng,
			ele: place.ele,
			deletedAt: place.deletedAt
		})
		.from(place)
		.orderBy(asc(place.name))
		.all()
		.map((p) => ({ ...p, nights: nights.get(p.id) ?? 0, comments: comments.get(p.id) ?? 0 }));

	return {
		places: rows.filter((p) => !p.deletedAt),
		// Removed places are only listed for admins, who can restore them.
		removed: isAdmin ? rows.filter((p) => p.deletedAt).map(({ id, name }) => ({ id, name })) : [],
		isAdmin
	};
};
