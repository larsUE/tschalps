import { fail } from '@sveltejs/kit';
import { asc } from 'drizzle-orm';
import { APIError } from 'better-auth/api';
import { ORIGIN } from '$app/env/private';
import { auth } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { user } from '#lib/server/db/schema.ts';
import { sendMail } from '#lib/server/mail.ts';
import type { Actions, PageServerLoad } from './$types';

const ROLES = ['user', 'admin'] as const;
type Role = (typeof ROLES)[number];
const isRole = (value: unknown): value is Role => ROLES.includes(value as Role);

export const load: PageServerLoad = async () => {
	const members = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
			banned: user.banned,
			createdAt: user.createdAt
		})
		.from(user)
		.orderBy(asc(user.name));
	return { members };
};

const errorMessage = (error: unknown) =>
	error instanceof APIError ? error.message : 'Unbekannter Fehler. Bitte versuche es nochmals.';

export const actions: Actions = {
	invite: async ({ request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const email = String(form.get('email') ?? '')
			.trim()
			.toLowerCase();
		const role = form.get('role');

		if (!name || !email || !isRole(role)) {
			return fail(400, { invite: { name, email, error: 'Name, E-Mail und Rolle sind nötig.' } });
		}

		try {
			await auth.api.createUser({ body: { name, email, role }, headers: request.headers });
		} catch (error) {
			const message =
				error instanceof APIError && error.status === 'BAD_REQUEST'
					? 'Diese E-Mail-Adresse ist ungültig oder bereits eingetragen.'
					: errorMessage(error);
			return fail(400, { invite: { name, email, error: message } });
		}

		await sendMail({
			to: email,
			subject: 'Willkommen bei Tschalps',
			text: [
				`Hoi ${name}`,
				'',
				'Du wurdest zur Tschalps-Plattform eingeladen: Archiv, Routen und Übernachtungsorte aller Tschalps.',
				'',
				`Melde dich hier mit deiner E-Mail-Adresse (${email}) an. Du erhältst jeweils einen Code per E-Mail, ein Passwort brauchst du nicht:`,
				`${ORIGIN}/login`
			].join('\n')
		});

		return { invited: email };
	},

	setRole: async ({ request, locals }) => {
		const form = await request.formData();
		const userId = String(form.get('userId') ?? '');
		const role = form.get('role');
		if (!isRole(role)) return fail(400, { error: 'Ungültige Rolle.' });
		if (userId === locals.user?.id)
			return fail(400, { error: 'Du kannst deine eigene Rolle nicht ändern.' });

		try {
			await auth.api.setRole({ body: { userId, role }, headers: request.headers });
		} catch (error) {
			return fail(400, { error: errorMessage(error) });
		}
	},

	deactivate: async ({ request, locals }) => {
		const form = await request.formData();
		const userId = String(form.get('userId') ?? '');
		if (userId === locals.user?.id)
			return fail(400, { error: 'Du kannst dich nicht selbst deaktivieren.' });

		try {
			// Banning (instead of deleting) keeps the member's tours, places and comments attributed.
			await auth.api.banUser({ body: { userId }, headers: request.headers });
		} catch (error) {
			return fail(400, { error: errorMessage(error) });
		}
	},

	reactivate: async ({ request }) => {
		const form = await request.formData();
		const userId = String(form.get('userId') ?? '');

		try {
			await auth.api.unbanUser({ body: { userId }, headers: request.headers });
		} catch (error) {
			return fail(400, { error: errorMessage(error) });
		}
	}
};
