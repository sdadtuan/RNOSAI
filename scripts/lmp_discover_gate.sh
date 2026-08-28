#!/usr/bin/env bash
# LMP Discover Phase 3 gate — cache, analytics, identity write-back
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

PYTHON="${PYTHON:-python3}"
if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
elif [[ -x "/var/www/ptt/.venv/bin/python" ]]; then
  PYTHON="/var/www/ptt/.venv/bin/python"
fi
export PYTHONPATH="$ROOT${PYTHONPATH:+:$PYTHONPATH}"

if ! "$PYTHON" -m pytest --version >/dev/null 2>&1; then
  "$PYTHON" -m pip install -q pytest
fi

echo "== LMP Discover Phase 3 gate =="

"$PYTHON" -m pytest "$ROOT/tests/test_lmp_discover.py" -q
echo "PASS  python discover tests"

"$PYTHON" -m pytest "$ROOT/tests/test_lmp_discover_cache.py" -q
echo "PASS  python discover cache tests"

if [[ -d "$ROOT/services/ptt-crm-api/node_modules" ]]; then
  (cd "$ROOT/services/ptt-crm-api" && npm test -- \
    --testPathPattern="lmp-discover-analytics|lmp-identity-writeback" --passWithNoTests 2>/dev/null)
  echo "PASS  nest discover analytics specs"
else
  echo "SKIP  nest spec (npm install in ptt-crm-api)"
fi

"$PYTHON" - <<'PY'
from ptt_crm.lead_meeting_prep import discover

assert discover.discover_cache_key({"phone": "0901234567"}) == "discover:phone:901234567"
assert discover.discover_cache_key({"email": "a@corp.vn"}) == "discover:email:a@corp.vn"
assert discover.discover_cache_enabled() is True
print("PASS  discover cache helpers")
PY

echo "PASS lmp_discover_gate"
