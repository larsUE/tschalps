import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '#lib/server/auth.ts';
import { safeRedirectTarget } from '#lib/server/redirect.ts';
import type { Actions, PageServerLoad } from './$types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeRedirectTarget(url.searchParams.get('redirectTo')));
};

async function readForm(request: Request) {
	const form = await request.formData();
	return {
		email: String(form.get('email') ?? '')
			.trim()
			.toLowerCase(),
		otp: String(form.get('otp') ?? '').replace(/\s/g, ''),
		// Carried through both steps so members land on the page they originally opened.
		redirectTo: String(form.get('redirectTo') ?? '')
	};
}

export const actions: Actions = {
	sendCode: async ({ request }) => {
		const { email, redirectTo } = await readForm(request);

		if (!EMAIL_RE.test(email)) {
			return fail(400, {
				step: 'email' as const,
				email,
				redirectTo,
				error: 'Bitte gib eine gültige E-Mail-Adresse ein.'
			});
		}

		// Responds the same way for unknown addresses, so membership can't be probed.
		await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } });

		return { step: 'code' as const, email, redirectTo };
	},

	verify: async ({ request }) => {
		const { email, otp, redirectTo } = await readForm(request);

		if (!EMAIL_RE.test(email)) {
			return fail(400, {
				step: 'email' as const,
				email,
				redirectTo,
				error: 'Bitte gib deine E-Mail-Adresse erneut ein.'
			});
		}
		if (!/^\d{6}$/.test(otp)) {
			return fail(400, {
				step: 'code' as const,
				email,
				redirectTo,
				error: 'Der Code besteht aus 6 Ziffern.'
			});
		}

		try {
			await auth.api.signInEmailOTP({ body: { email, otp }, headers: request.headers });
		} catch (error) {
			if (error instanceof APIError) {
				const message =
					error.status === 'FORBIDDEN'
						? 'Dein Zugang ist deaktiviert. Melde dich bei einem Admin.'
						: 'Der Code ist ungültig oder abgelaufen. Fordere einen neuen an.';
				return fail(400, { step: 'code' as const, email, redirectTo, error: message });
			}
			throw error;
		}

		redirect(303, safeRedirectTarget(redirectTo));
	}
};
