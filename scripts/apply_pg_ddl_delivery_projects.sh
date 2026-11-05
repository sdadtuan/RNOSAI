#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi
: "${DATABASE_URL:?DATABASE_URL required}"

for f in \
  "$ROOT/docs/specs/2026-09-04-postgresql-ddl-delivery-projects.sql" \
  "$ROOT/docs/specs/2026-09-04-postgresql-ddl-delivery-budget.sql" \
  "$ROOT/docs/specs/2026-09-04-postgresql-ddl-delivery-kpis.sql" \
  "$ROOT/docs/specs/2026-09-04-postgresql-ddl-delivery-ops.sql"; do
  echo "== apply $(basename "$f") =="
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
echo "OK  delivery DDL applied"
