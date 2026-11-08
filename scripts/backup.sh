#!/usr/bin/env bash
# Tschalps backup: a consistent database snapshot every run, plus an off-site copy.
#
#   scripts/backup.sh            (run from anywhere; reads the app's .env)
#
# Local:    BACKUP_DIR/tschalps-db-<timestamp>.sqlite.gz, kept BACKUP_KEEP_DAYS days.
# Off-site: when BACKUP_RCLONE_REMOTE is set (e.g. "swissbackup:tschalps"), the snapshots
#           are copied there and the uploads folder is mirrored. Files deleted in the app
#           are moved to uploads-deleted/<date> on the remote instead of being lost.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

if [[ -f .env ]]; then
	set -a
	# shellcheck disable=SC1091
	source .env
	set +a
fi

DB="${DATABASE_URL:?DATABASE_URL is not set}"
UPLOADS="${UPLOAD_DIR:-data/uploads}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
REMOTE="${BACKUP_RCLONE_REMOTE:-}"
REMOTE_KEEP_DAYS="${BACKUP_REMOTE_KEEP_DAYS:-90}"

stamp="$(date +%Y-%m-%d_%H%M)"
mkdir -p "$BACKUP_DIR"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# .backup takes a consistent snapshot even while the app is writing (WAL mode).
sqlite3 "$DB" ".backup '$tmp/tschalps.db'"
check="$(sqlite3 "$tmp/tschalps.db" 'PRAGMA integrity_check;')"
if [[ "$check" != "ok" ]]; then
	echo "Backup failed: integrity check returned: $check" >&2
	exit 1
fi
gzip -9 -c "$tmp/tschalps.db" >"$BACKUP_DIR/tschalps-db-$stamp.sqlite.gz"
echo "Database snapshot: $BACKUP_DIR/tschalps-db-$stamp.sqlite.gz"

find "$BACKUP_DIR" -name 'tschalps-db-*.sqlite.gz' -mtime +"$KEEP_DAYS" -delete

if [[ -n "$REMOTE" ]]; then
	command -v rclone >/dev/null || {
		echo "BACKUP_RCLONE_REMOTE is set but rclone is not installed" >&2
		exit 1
	}
	rclone copy "$BACKUP_DIR" "$REMOTE/db" --include 'tschalps-db-*.sqlite.gz'
	rclone delete "$REMOTE/db" --min-age "${REMOTE_KEEP_DAYS}d"
	if [[ -d "$UPLOADS" ]]; then
		rclone sync "$UPLOADS" "$REMOTE/uploads" --backup-dir "$REMOTE/uploads-deleted/$stamp"
	fi
	echo "Off-site copy: $REMOTE"
else
	echo "Note: BACKUP_RCLONE_REMOTE not set, uploads are not backed up off-site."
fi
