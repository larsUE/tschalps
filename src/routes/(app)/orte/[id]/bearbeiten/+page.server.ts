import { error, fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getPlace, readPlaceFields, removePlace, updatePlace } from '#lib/server/places.ts';
import type { Actions, PageServerLoad } from './$types';

const activePlace = (id: string) => {
	const p = getPlace(id);
	if (!p || p.deletedAt) error(404, 'Diesen Ort gibt es nicht (mehr).');
	return p;
};

export const load: PageServerLoad = ({ params }) => {
	const p = activePlace(params.id);
	return {
		place: {
			id: p.id,
			name: p.name,
			type: p.type,
			lat: p.lat,
			lng: p.lng,
			ele: p.ele,
			description: p.description,
			access: p.access,
			status: p.status
		}
	};
};

export const actions: Actions = {
	save: async ({ request, params, locals }) => {
		const p = activePlace(params.id);
		const { values, fields, errors } = readPlaceFields(await request.formData());
		if (errors.length) return fail(400, { values, errors });
		await updatePlace(p, fields, locals.user!.id);
		redirect(303, resolve('/(app)/orte/[id]', { id: p.id }));
	},

	remove: async ({ request, params, locals }) => {
		const p = activePlace(params.id);
		if ((await request.formData()).get('confirm') !== 'yes') {
			return fail(400, { removeError: 'Bitte bestätige das Entfernen.' });
		}
		removePlace(p.id, locals.user!.id);
		redirect(303, resolve('/(app)/orte'));
	}
};
