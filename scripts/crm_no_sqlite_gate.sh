# Wave 3 — fail if Nest/Python runtime still references file SQLite outside allowlist
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if command -v rg >/dev/null 2>&1; then
  if rg -n 'DatabaseSync|node:sqlite|PTT_SQLITE_PATH|SqliteRepository' \
    "$ROOT/services/ptt-crm-api/src" \
    --glob '!*.spec.ts' \
    --glob '!**/wave*-pg.constants.ts'; then
    echo "FAIL: Nest SQLite references remain"
    exit 1
  fi

  if ! rg -n 'assert_sqlite_file_allowed' "$ROOT/ptt_jobs/config.py" >/dev/null; then
    echo "FAIL: ptt_jobs/config.py missing sqlite file guard"
    exit 1
  fi
  if [[ ! -f "$ROOT/ptt_crm/sqlite_guard.py" ]]; then
    echo "FAIL: missing ptt_crm/sqlite_guard.py"
    exit 1
  fi
else
  echo "WARN: rg not installed — Nest/Python SQLite gate skipped"
fi

echo "crm_no_sqlite_gate: PASS"
