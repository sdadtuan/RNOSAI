#!/usr/bin/env bash
# Apply Account Management OS PostgreSQL DDL Wave 3 (AM-20260905-w3)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

DDL="$ROOT/docs/specs/2026-09-05-postgresql-ddl-am-w3.sql"

verify_ddl_static() {
  local missing=0
  local table
  for table in \
    crm_am_interactions \
    crm_am_risks \
    crm_am_recovery_plans; do
    if ! grep -q "CREATE TABLE IF NOT EXISTS ${table}" "$DDL"; then
      echo "MISSING table: ${table}" >&2
      missing=1
    fi
  done
  for column in \
    csd_ticket_id \
    escalation_level \
    resolution_summary \
    resolution_category; do
    if ! grep -q "ADD COLUMN IF NOT EXISTS ${column}" "$DDL"; then
      echo "MISSING column: ${column}" >&2
      missing=1
    fi
  done
  if [[ "$missing" -ne 0 ]]; then
    exit 1
  fi
  echo "OK  AM W3 DDL static verify (3 tables + 4 crm_am_tasks columns)"
}

URL="${DATABASE_URL:-}"
if [[ -z "$URL" ]]; then
  echo "SKIP live apply — DATABASE_URL unset"
  verify_ddl_static
  exit 0
fi

echo "Applying AM W3 DDL..."
echo "    DATABASE_URL=${URL%%@*}@…"
psql "$URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  AM W3 DDL applied (interactions, risks, recovery, task CSD columns)"
