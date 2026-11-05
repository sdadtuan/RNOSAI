#!/usr/bin/env bash
# Apply Internal Work Reporting PostgreSQL DDL (IWR-20260903)
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

DDL="$ROOT/docs/specs/2026-09-03-postgresql-ddl-iwr.sql"
echo "Applying IWR DDL..."
echo "    DATABASE_URL=${URL%%@*}@…"
psql "$URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  IWR DDL applied (iwr_* tables)"

echo "== seed iwr RBAC caps =="
bash "$ROOT/scripts/seed_iwr_rbac.sh" --apply
