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

python3 -m pytest "$ROOT/tests/test_lmp_input_resolver.py" -q && ok "python input resolver tests" || bad "python input resolver tests"
python3 -m pytest "$ROOT/tests/test_lmp_verify.py" -q && ok "python verify tests" || bad "python verify tests"
python3 -m pytest "$ROOT/tests/test_lmp_schema.py" -q && ok "python schema tests" || bad "python schema tests"

if [[ -d "$ROOT/services/ptt-crm-api/node_modules" ]]; then
  (cd "$ROOT/services/ptt-crm-api" && npm test -- --testPathPattern="lead-meeting-prep" --passWithNoTests 2>/dev/null) \
    && ok "nest LMP specs" || bad "nest LMP specs"
else
  echo "SKIP  nest spec (npm install in ptt-crm-api)"
fi

# Worker pipeline unit (no PG job / Tavily required)
python3 - <<'PY' && ok "synthesize stub shape"
from ptt_crm.lead_meeting_prep.synthesize import build_stub_llm_result
from ptt_crm.lead_meeting_prep.collect import collect_company
inp = {"lead_id": 1, "company_name": "Cty Gate", "industry": "BDS", "problem": "Can lead", "phone": "0901234567"}
collect = collect_company(inp)
result = build_stub_llm_result(inp, collect, verify_website=None, prep_stage="m1_first_strike")
assert result["contact_profile"]["found"] is False
assert 1 <= len(result["recommended_services"]) <= 3
assert result["meta"]["prompt_version"] == "lmp-synth-v1"
PY

if [[ "$fail" -eq 0 ]]; then
  echo "PASS lead_meeting_prep_gate ($pass checks)"
  exit 0
fi
echo "FAIL lead_meeting_prep_gate ($fail failures)"
exit 1
