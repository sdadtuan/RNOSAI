#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
SEED="$ROOT/docs/specs/2026-09-04-seed-kpi-hub-data.sql"
echo "==> Ensure KPI Hub DDL (P1 + P2)"
"$ROOT/scripts/apply_pg_ddl_kpi_hub_p2.sh"
echo "==> Seed KPI Hub data (workspace, 7 connections, 22 KPI, targets Sep 2026)"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SEED"
echo "OK  KPI Hub seed applied"
