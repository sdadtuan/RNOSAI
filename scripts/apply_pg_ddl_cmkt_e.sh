#!/usr/bin/env bash
# Apply CMKT-E DDL (requests, rights, packages, insights)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/2026-09-10-postgresql-ddl-cmkt-e.sql"

echo "==> Apply CMKT-E DDL"
echo "    DATABASE_URL=${DATABASE_URL%%@*}@***"
echo "    DDL=$DDL"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  CMKT-E DDL applied (schema_migrations: 2026-09-10-cmkt-e)"
