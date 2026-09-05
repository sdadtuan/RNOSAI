#!/usr/bin/env bash
# Apply Account Management OS PostgreSQL DDL G1 (AM-20260905-g1)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

DDL="$ROOT/docs/specs/2026-09-05-postgresql-ddl-am-g1.sql"

verify_ddl_static() {
  local missing=0
  local table
  for table in \
    crm_am_documents \
    crm_am_delegations; do
    if ! grep -q "CREATE TABLE IF NOT EXISTS ${table}" "$DDL"; then
      echo "MISSING table: ${table}" >&2
      missing=1
    fi
  done
  if [[ "$missing" -ne 0 ]]; then
    exit 1
  fi
  echo "OK  AM G1 DDL static verify (documents + delegations)"
}

URL="${DATABASE_URL:-}"
if [[ -z "$URL" ]]; then
  echo "SKIP live apply — DATABASE_URL unset"
  verify_ddl_static
  exit 0
fi

echo "Applying AM G1 DDL..."
echo "    DATABASE_URL=${URL%%@*}@…"
psql "$URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  AM G1 DDL applied (documents, delegations)"
