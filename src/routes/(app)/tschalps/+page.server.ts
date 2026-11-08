import { listTourSummaries, routeThumbnails } from '#lib/server/tours.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const thumbs = routeThumbnails();
	return {
		tours: listTourSummaries().map((t) => ({ ...t, thumb: thumbs.get(t.slug) ?? null }))
	};
};
