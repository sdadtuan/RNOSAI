#!/usr/bin/env bash
# Market Research OS P0 gate — EC-RES-02,04,05,06,08,10,11 (+ skip notes for live-only ECs).
#
#   bash scripts/market_research_gate.sh
#
# Live tenancy (EC-RES-06):
#   API_BASE=... BETA_TOKEN=... ACME_PROJECT_ID=... bash scripts/market_research_gate.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_BASE="${API_BASE:-http://127.0.0.1:3000}"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

echo "== Market Research P0 gate @ $(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown) =="

echo "== syntax =="
bash -n "$ROOT/scripts/market_research_gate.sh"
bash -n "$ROOT/scripts/smoke_market_research_p0.sh"
bash -n "$ROOT/scripts/deploy_market_research_vps.sh"
echo "OK  bash -n gate / smoke_p0 / deploy"

echo "== unit (EC-RES-04/05/06/08/10/11) =="
(
  cd "$ROOT/services/ptt-crm-api"
  npm test -- --testPathPattern=market-research --no-coverage
)

echo "EC-RES-01 nav — MANUAL: sidebar Lên kế hoạch shows Research + Marketing plan"
echo "EC-RES-02 POST project — unit + smoke_m1 (skip live if no ACCESS_TOKEN)"
echo "EC-RES-03 desk graceful — live-only; skip unless TAVILY_API_KEY + ACCESS_TOKEN (smoke_m2/m4)"
echo "EC-RES-04 insight_gate 400 — Jest evaluateInsightGate / submit-review"
echo "EC-RES-05 DOCX Evidence — Jest unzip word/document.xml"
echo "EC-RES-06 403 without title — Jest getProject outside scope"
echo "EC-RES-08 flag 404 — Jest MarketResearchEnabledGuard market_research_disabled"
echo "EC-RES-09 deep no insight insert — live-only; skip if RESEARCH_DEEP_PROVIDER=off"
echo "EC-RES-10 409 immutable — Jest PATCH verified evidence"
echo "EC-RES-11 self-approve 403 — Jest cannot_self_approve"
echo "EC-RES-12 ai_runs after desk — live-only; skip if no desk job"

if [[ -n "${BETA_TOKEN:-}" && -n "${ACME_PROJECT_ID:-}" ]]; then
  echo "== EC-RES-06 live tenancy =="
  HTTP_CODE="$(curl -sS -o /tmp/mr_gate_tenancy.json -w '%{http_code}' \
    -H "Authorization: Bearer $BETA_TOKEN" \
    "$API_BASE/api/v1/research/projects/$ACME_PROJECT_ID" || true)"
  echo "http=$HTTP_CODE body=$(cat /tmp/mr_gate_tenancy.json 2>/dev/null || true)"
  [[ "$HTTP_CODE" == "403" ]]
  python3 - <<'PY'
import json
body=json.load(open('/tmp/mr_gate_tenancy.json'))
blob=json.dumps(body)
assert body.get('error')=='forbidden', body
assert 'title' not in body, body
assert 'title' not in blob
print('OK  EC-RES-06 403 without title')
PY
else
  echo "SKIP EC-RES-06 live — set BETA_TOKEN and ACME_PROJECT_ID (Jest already asserts 403 without title)"
fi

echo "PASS market_research_gate"
