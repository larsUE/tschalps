import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) => (value === '' ? undefined : value);

export const variables = defineEnvVars({
	DATABASE_URL: { description: 'Path to the SQLite database file, e.g. `data/tschalps.db`.' },
	ORIGIN: {
		description: 'The app origin (base URL), e.g. `http://localhost:5173`.'
	},
	BETTER_AUTH_SECRET: {
		description:
			'Secret used to sign tokens. Generate with `openssl rand -base64 32`. See [Better Auth installation](https://www.better-auth.com/docs/installation).'
	},
	UPLOAD_DIR: {
		description: 'Directory for uploaded GPX files and photos (outside the web root).',
		schema: (value) => optional(value) ?? 'data/uploads'
	},
	SMTP_HOST: {
		description:
			'SMTP server (e.g. `mail.infomaniak.com`). If empty, e-mails are logged to the console.',
		schema: optional
	},
	SMTP_PORT: {
		description: 'SMTP port, usually 465 (TLS) or 587 (STARTTLS).',
		schema: (value) => Number(optional(value) ?? 465)
	},
	SMTP_USER: { description: 'SMTP user name.', schema: optional },
	SMTP_PASS: { description: 'SMTP password.', schema: optional },
	MAIL_FROM: {
		description: 'Sender address, e.g. `Tschalps <noreply@tschalps.ch>`.',
		schema: (value) => optional(value) ?? 'Tschalps <noreply@localhost>'
	}
});
