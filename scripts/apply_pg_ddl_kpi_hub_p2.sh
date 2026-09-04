#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL_P1="$ROOT/docs/specs/2026-09-04-postgresql-ddl-kpi-hub.sql"
DDL_P2="$ROOT/docs/specs/2026-09-04-postgresql-ddl-kpi-hub-p2.sql"
echo "==> Apply KPI Hub P1 DDL (if needed)"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL_P1"
echo "==> Apply KPI Hub P2 DDL"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL_P2"
echo "OK  KPI Hub P2 DDL applied"
