#!/usr/bin/env bash
# Apply CMKT-E3 brand glossary / localization memory DDL
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/2026-09-11-postgresql-ddl-cmkt-e3-glossary.sql"

echo "==> Apply CMKT-E3 glossary DDL"
echo "    DATABASE_URL=${DATABASE_URL%%@*}@***"
echo "    DDL=$DDL"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  CMKT-E3 glossary DDL applied (schema_migrations: 2026-09-11-cmkt-e3-glossary)"
