# Tschalps

Members-only archive and map for Tschalps. Design and roadmap: [ARCHITECTURE.md](ARCHITECTURE.md).

SvelteKit 3 · Svelte 5 · SQLite (Drizzle, better-sqlite3) · Better Auth (e-mail code login) · Tailwind 4

## Local development

```sh
npm install
cp .env.example .env            # then set BETTER_AUTH_SECRET: openssl rand -base64 32
npm run admin:create -- you@example.ch "Vorname Nachname"
npm run dev
```

Without `SMTP_HOST`, e-mails (login codes, invitations) are printed to the dev server console.

## Scripts

| Script                                   | What it does                                                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                            | Dev server on http://localhost:5173                                                                               |
| `npm run check` / `npm run lint`         | Type check / Prettier + ESLint                                                                                    |
| `npm run admin:create -- <email> <name>` | Create the first admin, or promote an existing user                                                               |
| `npm run db:generate`                    | Create a SQL migration in `drizzle/` after changing `src/lib/server/db/schema.ts`                                 |
| `npm run db:migrate`                     | Apply migrations (the app also applies them on startup)                                                           |
| `npm run auth:schema`                    | Regenerate Better Auth tables (`scripts/auth-schema/auth.ts` must mirror the plugins in `src/lib/server/auth.ts`) |
| `npm run db:studio`                      | Browse the database                                                                                               |

## How login works

- No passwords and no self-registration. Admins add members at `/admin/mitglieder`, and members receive an invitation e-mail.
- Members log in with a 6-digit code sent by e-mail. Unknown addresses get the same response but no e-mail.
- "Deaktivieren" bans a member: their sessions end and they can't log in, but their content stays attributed to them.
- `src/hooks.server.ts` protects every route except `/login` and `/api/auth/*`. `/admin/*` is for admins only.

## Deployment (Infomaniak VPS Cloud)

1. Install Node 24 LTS and build-essential (needed by `better-sqlite3`).
2. Copy the project to e.g. `/srv/tschalps`, then run `npm ci && npm run build`.
3. Create `/srv/tschalps/.env` with the production values: `ORIGIN=https://…`, a fresh `BETTER_AUTH_SECRET`, absolute paths for `DATABASE_URL`/`UPLOAD_DIR`, `BODY_SIZE_LIMIT=25M` (GPX uploads; the default is 512K), and Infomaniak SMTP credentials.
4. Run `npm run admin:create -- …` once.
5. Run `node --env-file=.env build` under systemd (it listens on `PORT`, default 3000), behind Caddy or nginx for HTTPS. The `drizzle/` folder must sit next to `build/`, because migrations run on startup.
6. Back up nightly: `sqlite3 data/tschalps.db ".backup data/backup.db"`, then copy the backup and `data/uploads` to Swiss Backup.
