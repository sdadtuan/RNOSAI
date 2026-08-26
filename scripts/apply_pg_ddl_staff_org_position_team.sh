#!/usr/bin/env bash
# Apply staff org position → team DDL
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/postgresql-ddl-staff-org-position-team.sql"

echo "==> Apply staff org position-team DDL"
echo "    DATABASE_URL=${DATABASE_URL%%@*}@***"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  staff org position-team DDL applied"
