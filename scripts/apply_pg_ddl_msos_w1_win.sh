#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/2026-09-12-postgresql-ddl-msos-w1-win.sql"
echo "==> Apply MSOS W1+WIN DDL"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  MSOS W1+WIN DDL applied (schema_migrations: 2026-09-12-msos-w1-win)"
