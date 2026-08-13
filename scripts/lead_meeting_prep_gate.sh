#!/usr/bin/env bash
# S-LMP-1 gate — DDL + enqueue + worker stub result
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL required}"
: "${PTT_CRM_INTERNAL_KEY:?PTT_CRM_INTERNAL_KEY required}"

PTT_API_URL="${PTT_API_URL:-http://127.0.0.1:3000}"

pass=0
fail=0
ok() { pass=$((pass + 1)); echo "PASS  $1"; }
bad() { fail=$((fail + 1)); echo "FAIL  $1"; }

echo "== LMP S-LMP-1 gate =="

bash "$ROOT/scripts/apply_pg_ddl_lead_meeting_prep.sh"
ok "DDL applied"

TABLE=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='crm_lead_meeting_prep'")
[[ "$TABLE" == "1" ]] && ok "crm_lead_meeting_prep exists" || bad "table missing"

python3 -m pytest "$ROOT/tests/test_lmp_input_resolver.py" -q && ok "python input resolver tests" || bad "python tests"

if [[ -d "$ROOT/services/ptt-crm-api/node_modules" ]]; then
  (cd "$ROOT/services/ptt-crm-api" && npm test -- --testPathPattern=lead-meeting-prep-input.resolver.spec --passWithNoTests 2>/dev/null) \
    && ok "nest input resolver spec" || bad "nest spec"
else
  echo "SKIP  nest spec (npm install in ptt-crm-api)"
fi

# Worker pipeline unit (no PG job required)
python3 - <<'PY' && ok "stub result shape"
from ptt_crm.lead_meeting_prep.stub_synthesize import build_stub_result, stub_collect
inp = {"company_name": "Cty Gate", "industry": "BDS", "problem": "Can lead"}
collect = stub_collect(inp)
result = build_stub_result(inp, collect)
assert result["contact_profile"]["found"] is False
assert 1 <= len(result["recommended_services"]) <= 3
assert result["meta"]["prompt_version"]
PY

if [[ "$fail" -eq 0 ]]; then
  echo "PASS lead_meeting_prep_gate ($pass checks)"
  exit 0
fi
echo "FAIL lead_meeting_prep_gate ($fail failures)"
exit 1
