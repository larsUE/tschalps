import { fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { db } from '#lib/server/db/index.ts';
import { tour } from '#lib/server/db/schema.ts';
import {
	parseGpxUploads,
	readTourFields,
	saveStages,
	setParticipants,
	uniqueSlug
} from '#lib/server/tours.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ year: new Date().getFullYear() });

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const user = locals.user!;
		const form = await request.formData();
		const { values, fields, errors } = readTourFields(form);
		const gpx = await parseGpxUploads(form);
		errors.push(...gpx.errors);
		if (gpx.count === 0) errors.push('Bitte lade mindestens eine GPX-Datei hoch.');

		if (errors.length) return fail(400, { values, errors });

		const id = crypto.randomUUID();
		const slug = uniqueSlug(fields.year, fields.title);
		db.insert(tour)
			.values({ id, slug, ...fields, createdBy: user.id })
			.run();
		if (form.get('participated')) setParticipants(id, [user.id]);
		await saveStages(id, gpx.result);

		redirect(303, resolve('/(app)/tschalps/[slug]', { slug }));
	}
};
