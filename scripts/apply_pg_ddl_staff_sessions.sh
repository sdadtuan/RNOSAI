#!/usr/bin/env bash
# Apply staff sessions + avatar DDL (STAFF-ACCOUNT-20260901)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/2026-09-01-postgresql-ddl-staff-sessions.sql"

echo "==> Apply staff sessions + avatar DDL (STAFF-ACCOUNT-20260901)"
echo "    DATABASE_URL=$DATABASE_URL"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  staff sessions + avatar DDL applied"
