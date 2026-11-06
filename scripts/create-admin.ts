// Creates the first admin (or promotes an existing user to admin).
// Usage: npm run admin:create -- someone@example.ch "Vorname Nachname"
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const [email, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(' ').trim();
const dbPath = process.env.DATABASE_URL;

if (!email || !email.includes('@') || !name) {
	console.error('Usage: npm run admin:create -- <email> "<Name>"');
	process.exit(1);
}
if (!dbPath) {
	console.error('DATABASE_URL is not set (see .env)');
	process.exit(1);
}

mkdirSync(dirname(dbPath), { recursive: true });
const client = new Database(dbPath);
client.pragma('foreign_keys = ON');
migrate(drizzle(client), { migrationsFolder: 'drizzle' });

const normalized = email.trim().toLowerCase();
const now = Date.now();
const existing = client.prepare('SELECT id FROM user WHERE email = ?').get(normalized) as
	{ id: string } | undefined;

if (existing) {
	client
		.prepare("UPDATE user SET role = 'admin', banned = 0, updated_at = ? WHERE id = ?")
		.run(now, existing.id);
	console.log(`${normalized} ist jetzt Admin.`);
} else {
	client
		.prepare(
			`INSERT INTO user (id, name, email, email_verified, role, banned, created_at, updated_at)
			 VALUES (?, ?, ?, 0, 'admin', 0, ?, ?)`
		)
		.run(crypto.randomUUID(), name, normalized, now, now);
	console.log(`Admin ${name} <${normalized}> erstellt.`);
}
