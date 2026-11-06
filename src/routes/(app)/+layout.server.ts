import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	// hooks.server.ts already guards; this narrows the type for all child pages.
	if (!locals.user) redirect(303, '/login');
	const { id, name, email, role } = locals.user;
	return { user: { id, name, email, isAdmin: role === 'admin' } };
};
