#!/usr/bin/env bash
# Apply Account Management OS PostgreSQL DDL Wave 2 (AM-20260905-w2)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

DDL="$ROOT/docs/specs/2026-09-05-postgresql-ddl-am-w2.sql"

verify_ddl_static() {
  local missing=0
  local table
  for table in \
    crm_am_contacts \
    crm_am_handovers \
    crm_am_onboarding_templates \
    crm_am_onboarding_cases \
    crm_am_renewal_cases; do
    if ! grep -q "CREATE TABLE IF NOT EXISTS ${table}" "$DDL"; then
      echo "MISSING table: ${table}" >&2
      missing=1
    fi
  done
  if ! grep -q "CREATE UNIQUE INDEX IF NOT EXISTS crm_am_renewal_open_uq" "$DDL"; then
    echo "MISSING index: crm_am_renewal_open_uq" >&2
    missing=1
  fi
  if [[ "$missing" -ne 0 ]]; then
    exit 1
  fi
  echo "OK  AM W2 DDL static verify (5 tables + crm_am_renewal_open_uq)"
}

URL="${DATABASE_URL:-}"
if [[ -z "$URL" ]]; then
  echo "SKIP live apply — DATABASE_URL unset"
  verify_ddl_static
  exit 0
fi

echo "Applying AM W2 DDL..."
echo "    DATABASE_URL=${URL%%@*}@…"
psql "$URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  AM W2 DDL applied (crm_am_contacts, handovers, onboarding, renewal)"
