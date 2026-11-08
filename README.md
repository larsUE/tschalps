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

Ready-made files are in [`deploy/`](deploy): a systemd service, a nightly backup timer and a Caddyfile.

1. **Server:** install Node 24 LTS, `build-essential` and `python3` (to compile `better-sqlite3`), `sqlite3`, Caddy and, for off-site backups, `rclone`. Create a user: `sudo useradd --system --create-home --home-dir /srv/tschalps tschalps`.
2. **App:** as that user, clone the repo into `/srv/tschalps`, then `npm ci && npm run build`. (`package.json` allows only `better-sqlite3` to run an install script; re-approve it with `npm install-scripts approve better-sqlite3` after upgrading it.)
3. **Settings:** copy `.env.example` to `/srv/tschalps/.env` and fill in:
   - `ORIGIN=https://<your domain>` and a fresh `BETTER_AUTH_SECRET` (`openssl rand -base64 32`)
   - `DATABASE_URL=/srv/tschalps/data/tschalps.db`, `UPLOAD_DIR=/srv/tschalps/data/uploads` (the service may only write inside `data/`)
   - `PORT=3000`, `BODY_SIZE_LIMIT=25M`
   - Infomaniak SMTP: `SMTP_HOST=mail.infomaniak.com`, `SMTP_PORT=465`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`
4. **First admin:** `npm run admin:create -- you@example.ch "Vorname Nachname"`.
5. **Service:** `sudo cp deploy/tschalps.service deploy/tschalps-backup.* /etc/systemd/system/`, then `sudo systemctl daemon-reload && sudo systemctl enable --now tschalps tschalps-backup.timer`. Migrations run on startup (the `drizzle/` folder must stay next to `build/`).
6. **HTTPS:** put your domain into `deploy/Caddyfile`, copy it to `/etc/caddy/Caddyfile`, `sudo systemctl reload caddy`.

**Updating:** `git pull && npm ci && npm run build && sudo systemctl restart tschalps`.

## Backups

`scripts/backup.sh` (run nightly by `tschalps-backup.timer`):

- takes a consistent snapshot of the database while the app runs, checks it, and keeps it gzipped in `BACKUP_DIR` for `BACKUP_KEEP_DAYS` days;
- if `BACKUP_RCLONE_REMOTE` is set, copies the snapshots there (kept `BACKUP_REMOTE_KEEP_DAYS` days) and mirrors `data/uploads`. Files deleted in the app are moved to `uploads-deleted/<date>` on the remote rather than lost.

Off-site to **Infomaniak Swiss Backup**: create an rclone remote for it once (`rclone config`, as user `tschalps`; Swiss Backup offers S3 and OpenStack Swift access) and set e.g. `BACKUP_RCLONE_REMOTE=swissbackup:tschalps`. Test with `sudo -u tschalps /srv/tschalps/scripts/backup.sh`.

**Restore:** stop the app, then

```sh
gunzip -c backups/tschalps-db-<timestamp>.sqlite.gz > data/tschalps.db
rm -f data/tschalps.db-wal data/tschalps.db-shm
rclone copy swissbackup:tschalps/uploads data/uploads   # if uploads were lost
sudo systemctl start tschalps
```
