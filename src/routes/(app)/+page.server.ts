import { listTourSummaries } from '#lib/server/tours.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ tours: listTourSummaries() });
