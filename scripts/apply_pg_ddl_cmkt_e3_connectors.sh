#!/usr/bin/env bash
# Apply CMKT-E3 connector framework DDL (default off)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/2026-09-11-postgresql-ddl-cmkt-e3-connectors.sql"

echo "==> Apply CMKT-E3 connector DDL"
echo "    DATABASE_URL=${DATABASE_URL%%@*}@***"
echo "    DDL=$DDL"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  CMKT-E3 connector DDL applied (schema_migrations: 2026-09-11-cmkt-e3-connectors)"
