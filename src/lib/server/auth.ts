import { ORIGIN, BETTER_AUTH_SECRET } from '$app/env/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { admin, emailOTP } from 'better-auth/plugins';
import { getRequestEvent } from '$app/server';
import { db } from '#lib/server/db/index.ts';
import { sendMail } from '#lib/server/mail.ts';

export const auth = betterAuth({
	appName: 'Tschalps',
	baseURL: ORIGIN,
	secret: BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'sqlite' }),
	// Members only: no passwords, no self-registration. Admins create users,
	// users log in with a one-time code sent by e-mail.
	emailAndPassword: { enabled: false },
	session: {
		expiresIn: 60 * 60 * 24 * 60, // 60 days
		updateAge: 60 * 60 * 24 // refresh daily while in use
	},
	plugins: [
		emailOTP({
			disableSignUp: true,
			otpLength: 6,
			expiresIn: 10 * 60,
			allowedAttempts: 5,
			storeOTP: 'hashed',
			async sendVerificationOTP({ email, otp, type }) {
				if (type !== 'sign-in') return;
				await sendMail({
					to: email,
					subject: `Dein Tschalps-Anmeldecode: ${otp}`,
					text: [
						'Hoi',
						'',
						`Dein Anmeldecode für Tschalps lautet: ${otp}`,
						'',
						'Der Code ist 10 Minuten gültig. Falls du dich nicht anmelden wolltest, kannst du diese E-Mail ignorieren.'
					].join('\n')
				});
			}
		}),
		admin({ defaultRole: 'user', adminRoles: ['admin'] }),
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});

export type SessionUser = typeof auth.$Infer.Session.user;
export type SessionData = typeof auth.$Infer.Session.session;
