#!/usr/bin/env bash
# Apply Communication & Service Desk PostgreSQL DDL (CSD-20260902)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

URL="${DATABASE_URL:-}"
if [[ -z "$URL" ]]; then
  echo "Set DATABASE_URL in .env" >&2
  exit 1
fi

DDL="$ROOT/docs/specs/2026-09-02-postgresql-ddl-csd.sql"
echo "Applying CSD DDL..."
echo "    DATABASE_URL=${URL%%@*}@…"
psql "$URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  CSD DDL applied (csd_* tables; crm_tickets / ceo_command_* untouched)"
