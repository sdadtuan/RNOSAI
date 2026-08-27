#!/usr/bin/env bash
# Wave 2 — fail if Nest runtime still references SQLite outside allowlist
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if rg -n 'DatabaseSync|node:sqlite|PTT_SQLITE_PATH|SqliteRepository' \
  "$ROOT/services/ptt-crm-api/src" \
  --glob '!*.spec.ts' \
  --glob '!**/wave*-pg.constants.ts'; then
  echo "FAIL: SQLite references remain"; exit 1
fi
echo "crm_no_sqlite_gate: PASS"
