#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/2026-09-03-postgresql-ddl-kpi-types.sql"
echo "==> Apply KPI Types DDL"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  KPI Types DDL applied"
