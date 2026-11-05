#!/usr/bin/env bash
# Apply RevOps Wave 3 PostgreSQL DDL (REVOPS-20260905-w3)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

DDL="$ROOT/docs/specs/2026-09-05-postgresql-ddl-revops-w3.sql"

verify_ddl_static() {
  local missing=0
  local table
  for table in \
    crm_revops_commission_plans \
    crm_revops_commission_tiers \
    crm_revops_commission_transactions \
    crm_revops_payout_batches \
    crm_revops_sla_policies \
    crm_revops_sla_incidents \
    crm_revops_territories \
    crm_revops_routing_rules; do
    if ! grep -q "CREATE TABLE IF NOT EXISTS ${table}" "$DDL"; then
      echo "MISSING table: ${table}" >&2
      missing=1
    fi
  done
  if [[ "$missing" -ne 0 ]]; then
    exit 1
  fi
  echo "OK  RevOps W3 DDL static verify (8 tables)"
}

URL="${DATABASE_URL:-}"
if [[ -z "$URL" ]]; then
  echo "SKIP live apply — DATABASE_URL unset"
  verify_ddl_static
  exit 0
fi

echo "Applying RevOps W3 DDL..."
echo "    DATABASE_URL=${URL%%@*}@…"
psql "$URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  RevOps W3 DDL applied (commission, SLA, territory, routing)"
