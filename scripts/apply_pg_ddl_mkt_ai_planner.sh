#!/usr/bin/env bash
# Apply MKT-AI-01 marketing AI planner DDL
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/2026-08-08-postgresql-ddl-mkt-ai-planner.sql"

echo "==> Apply MKT-AI planner DDL"
echo "    DATABASE_URL=${DATABASE_URL%%@*}@***"
echo "    DDL=$DDL"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  MKT-AI planner DDL applied (schema_migrations: 2026-08-08-mkt-ai-planner)"
