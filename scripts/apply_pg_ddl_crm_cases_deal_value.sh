#!/usr/bin/env bash
# Apply crm_cases.deal_value_vnd column (PG bridge gap from SQLite schema).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/postgresql-ddl-crm-cases-deal-value.sql"

echo "==> Apply crm_cases deal_value_vnd DDL"
echo "    DATABASE_URL=${DATABASE_URL%%@*}@***"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  crm_cases deal_value_vnd DDL applied"
