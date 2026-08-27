#!/usr/bin/env bash
# Backup the authoritative PostgreSQL database (Wave 2)
set -euo pipefail
BACKUP_DIR="${PTT_BACKUP_DIR:-/var/backups/ptt}"
RETENTION_DAYS="${PTT_BACKUP_RETENTION_DAYS:-14}"
TS="$(date +%Y%m%d-%H%M)"
mkdir -p "$BACKUP_DIR"

: "${DATABASE_URL:?DATABASE_URL required for PostgreSQL backup}"

PG_OUT="$BACKUP_DIR/rnosaidb-${TS}.dump"

echo "==> pg_dump → $PG_OUT"
if command -v pg_dump >/dev/null 2>&1; then
  pg_dump "$DATABASE_URL" -Fc -f "$PG_OUT"
else
  echo "FAIL: pg_dump not found" >&2
  exit 1
fi
test -s "$PG_OUT"

if [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] && [[ "$RETENTION_DAYS" -gt 0 ]]; then
  find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'rnosaidb-*.dump' -o -name 'ptt_agency-*.dump' \) -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true
fi

echo "OK PostgreSQL backup complete: $PG_OUT"
