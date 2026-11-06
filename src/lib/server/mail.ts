import nodemailer from 'nodemailer';
import { MAIL_FROM, SMTP_HOST, SMTP_PASS, SMTP_PORT, SMTP_USER } from '$app/env/private';

const transport = SMTP_HOST
	? nodemailer.createTransport({
			host: SMTP_HOST,
			port: SMTP_PORT,
			secure: SMTP_PORT === 465,
			auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
		})
	: null;

type Mail = { to: string; subject: string; text: string };

export async function sendMail({ to, subject, text }: Mail) {
	if (!transport) {
		// Development: no SMTP configured, print the mail instead of sending it.
		console.log(`\n✉️  Mail an ${to}\n   Betreff: ${subject}\n\n${text}\n`);
		return;
	}
	await transport.sendMail({ from: MAIL_FROM, to, subject, text });
}
