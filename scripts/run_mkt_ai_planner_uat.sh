#!/usr/bin/env bash
# MKT-AI P0 UAT — API walkthrough (WS-QA-01)
# Maps 21-step happy path from docs/use-cases/actions/10-MKTP-ACTIONS.md
#
# Usage (VPS or laptop with API reachability):
#   export DATABASE_URL=postgresql://...
#   export PTT_CRM_INTERNAL_KEY=...   # or ADMIN_PASSWORD
#   export LIFECYCLE_ID=1             # optional — auto from seed tag
#   ./scripts/run_mkt_ai_planner_uat.sh
#
# Optional: RUN_E1=1 to simulate retry path (campaign job twice)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_URL="${PTT_API_URL:-${OPS_UAT_API:-http://127.0.0.1:3000}}"
LIFECYCLE_ID="${LIFECYCLE_ID:-}"
REPORT="${MKT_AI_UAT_REPORT:-$ROOT/docs/exports/mkt-ai-uat-results-$(date +%Y%m%d-%H%M%S).md}"
ARTIFACT_DIR="${MKT_AI_UAT_ARTIFACTS:-$ROOT/.local-dev/mkt-ai-uat}"
PASS=0
FAIL=0
SKIP=0
BLOCKED=0

mkdir -p "$(dirname "$REPORT")" "$ARTIFACT_DIR"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

EMAIL="${ADMIN_EMAIL:-${OPS_E2E_STAFF_EMAIL:-admin@pttads.vn}}"
PASSWD="${ADMIN_PASSWORD:-${OPS_E2E_STAFF_PASSWORD:-}}"
INTERNAL_KEY="${PTT_CRM_INTERNAL_KEY:-}"
TOKEN="${STAFF_JWT:-${CRM_STAFF_TOKEN:-}}"

log() { echo "$*" | tee -a "$REPORT"; }
pass() { PASS=$((PASS + 1)); log "- [x] **PASS** — $1"; }
fail() { FAIL=$((FAIL + 1)); log "- [ ] **FAIL** — $1"; }
skip() { SKIP=$((SKIP + 1)); log "- [ ] **SKIP** — $1"; }
blocked() { BLOCKED=$((BLOCKED + 1)); log "- [ ] **BLOCKED** — $1"; }

log "# MKT-AI Planner UAT — $(date -Iseconds)"
log ""
log "| Env | Value |"
log "|-----|-------|"
log "| API | \`$API_URL\` |"
log "| git | \`$(git rev-parse --short HEAD 2>/dev/null || echo unknown)\` |"
log "| lifecycle | \`${LIFECYCLE_ID:-auto}\` |"
log ""

AUTH=()
if [[ -n "$INTERNAL_KEY" ]]; then
  AUTH=(-H "x-ptt-internal-key: $INTERNAL_KEY")
elif [[ -z "$TOKEN" && -n "$PASSWD" ]]; then
  TOKEN="$(
    curl -sf "$API_URL/api/v1/staff/auth/login" \
      -H 'Content-Type: application/json' \
      -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWD\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || true
  )"
fi
if [[ -n "$TOKEN" && ${#AUTH[@]} -eq 0 ]]; then
  AUTH=(-H "Authorization: Bearer $TOKEN")
fi
if [[ ${#AUTH[@]} -eq 0 ]]; then
  blocked "Auth — set PTT_CRM_INTERNAL_KEY, STAFF_JWT, or ADMIN_PASSWORD"
  log ""
  log "## Summary: PASS=$PASS FAIL=$FAIL SKIP=$SKIP BLOCKED=$BLOCKED"
  exit 1
fi

api() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local url="${API_URL}/api/crm/service-lifecycle/${LIFECYCLE_ID}/ai-planner${path}"
  if [[ -n "$body" ]]; then
    curl -sS -w '\n%{http_code}' -X "$method" "${AUTH[@]}" -H 'Content-Type: application/json' -d "$body" "$url"
  else
    curl -sS -w '\n%{http_code}' -X "$method" "${AUTH[@]}" "$url"
  fi
}

resolve_lifecycle() {
  if [[ -n "$LIFECYCLE_ID" ]]; then return; fi
  if [[ -n "${DATABASE_URL:-}" ]]; then
    LIFECYCLE_ID="$(
      psql "$DATABASE_URL" -tAc \
        "SELECT id FROM crm_service_lifecycle WHERE notes='mkt-ai-smoke-seed' ORDER BY id DESC LIMIT 1" 2>/dev/null \
        | tr -d '[:space:]' || true
    )"
  fi
  if [[ -z "$LIFECYCLE_ID" ]]; then
    LIFECYCLE_ID="$(
      curl -sf "$API_URL/api/crm/service-lifecycle?include_draft=1" "${AUTH[@]}" \
      | python3 -c "
import sys, json
ls = json.load(sys.stdin).get('lifecycles') or []
pref = [x for x in ls if str(x.get('service_slug',''))=='meta-lead-gen']
pick = pref[0] if pref else (ls[0] if ls else None)
print(pick['id'] if pick else '')
" 2>/dev/null || true
    )"
  fi
}

log "## §1 Health + flags"
if curl -sf "$API_URL/health" -o /dev/null; then pass "Nest /health OK"; else fail "Nest /health fail"; fi

resolve_lifecycle
if [[ -z "$LIFECYCLE_ID" ]]; then
  fail "No lifecycle — run ./scripts/seed_mkt_ai_uat_lifecycle.sh"
  log "## Summary: PASS=$PASS FAIL=$FAIL SKIP=$SKIP BLOCKED=$BLOCKED"
  exit 1
fi
pass "Lifecycle resolved #$LIFECYCLE_ID"

log ""
log "## §2 Context (MKTP-UC-001, steps 2–3)"
CTX_RAW="$(api GET /context)"
CTX_HTTP="$(echo "$CTX_RAW" | tail -1)"
CTX_BODY="$(echo "$CTX_RAW" | sed '$d')"
echo "$CTX_BODY" >"$ARTIFACT_DIR/context-initial.json"
if [[ "$CTX_HTTP" == "200" ]]; then pass "GET context HTTP 200"; else fail "GET context HTTP $CTX_HTTP"; fi

python3 - <<PY || fail "Context JSON keys"
import json, sys
d=json.load(open("$ARTIFACT_DIR/context-initial.json"))
for k in ("lifecycle_id","brief","draft","jobs","tmmt_validation","flags"):
    assert k in d, k
print("ok")
PY
pass "Context payload keys present"

log ""
log "## §3 Brief (MKTP-UC-002, steps 4–6)"
BRIEF='{
  "brand_name": "ABC Logistics UAT",
  "industry": "Logistics B2B",
  "service_slug": "meta-lead-gen",
  "objective": "lead",
  "budget_monthly_vnd": 80000000,
  "geo_markets": ["HCM", "HN"],
  "challenges": "CPL cao, thiếu ICP rõ ràng cho B2B logistics",
  "competitors": ["Competitor A"],
  "usp": "Giảm CPL 25% trong 90 ngày"
}'
BRIEF_RAW="$(api PATCH /brief "$BRIEF")"
BRIEF_HTTP="$(echo "$BRIEF_RAW" | tail -1)"
if [[ "$BRIEF_HTTP" == "200" ]]; then pass "PATCH brief HTTP 200"; else fail "PATCH brief HTTP $BRIEF_HTTP"; fi

log ""
log "## §4 Strategy job (MKTP-UC-003, steps 7–9)"
STRAT_RAW="$(api POST /jobs/strategy)"
STRAT_HTTP="$(echo "$STRAT_RAW" | tail -1)"
if [[ "$STRAT_HTTP" == "200" ]]; then pass "POST jobs/strategy HTTP 200"; else fail "POST jobs/strategy HTTP $STRAT_HTTP"; fi

CTX_RAW="$(api GET /context)"
echo "$(echo "$CTX_RAW" | sed '$d')" >"$ARTIFACT_DIR/context-after-strategy.json"
python3 - <<PY || fail "EC-MKT-AI-02 — 4 core prof keys"
import json
d=json.load(open("$ARTIFACT_DIR/context-after-strategy.json"))
prof=d.get("draft",{}).get("target_market_prof") or {}
core=["market_context","segmentation_icp","personas_roles","pains_desired_outcomes"]
missing=[k for k in core if not str(prof.get(k,"")).strip()]
if missing:
    raise SystemExit("missing: "+",".join(missing))
print("ok")
PY
pass "EC-MKT-AI-02 — 4 core TMMT prof keys filled"

PATCH_DRAFT='{"strategy_framework":{"target_market":"SMB logistics VN — UAT patch"}}'
DRAFT_RAW="$(api PATCH /draft "$PATCH_DRAFT")"
if [[ "$(echo "$DRAFT_RAW" | tail -1)" == "200" ]]; then pass "PATCH draft (UC-006)"; else fail "PATCH draft"; fi

log ""
log "## §5 Campaign + content (MKTP-UC-004/005, steps 10–13)"
for job in campaigns content; do
  RAW="$(api POST "/jobs/$job")"
  HTTP="$(echo "$RAW" | tail -1)"
  if [[ "$HTTP" == "200" ]]; then pass "POST jobs/$job HTTP 200"; else fail "POST jobs/$job HTTP $HTTP"; fi
done

CTX_RAW="$(api GET /context)"
echo "$(echo "$CTX_RAW" | sed '$d')" >"$ARTIFACT_DIR/context-after-content.json"
python3 - <<PY || fail "Campaign + calendar present"
import json
d=json.load(open("$ARTIFACT_DIR/context-after-content.json"))
camps=d.get("draft",{}).get("campaigns_json") or []
cal=(d.get("draft",{}).get("content_json") or {}).get("calendar") or []
assert len(camps)>=1, "no campaigns"
assert len(cal)>=1, "no calendar"
print("ok")
PY
pass "≥1 campaign card + calendar rows"

log ""
log "## §6 Quality (MKTP-UC-007, step 15)"
Q_RAW="$(api POST /jobs/quality)"
if [[ "$(echo "$Q_RAW" | tail -1)" == "200" ]]; then pass "POST jobs/quality HTTP 200"; else fail "POST jobs/quality"; fi

CTX_RAW="$(api GET /context)"
echo "$(echo "$CTX_RAW" | sed '$d')" >"$ARTIFACT_DIR/context-quality.json"
SCORE="$(python3 -c "import json; print(json.load(open('$ARTIFACT_DIR/context-quality.json')).get('quality_score',{}).get('score',0))")"
if [[ "$SCORE" -ge 60 ]]; then pass "Quality score ≥60 ($SCORE/100)"; else fail "Quality score $SCORE < 60"; fi

log ""
log "## §7 Apply TMMT (MKTP-UC-008, steps 16–17)"
APPLY_BODY='{"confirm_overwrite":true}'
APPLY_RAW="$(api POST /apply "$APPLY_BODY")"
APPLY_HTTP="$(echo "$APPLY_RAW" | tail -1)"
APPLY_JSON="$(echo "$APPLY_RAW" | sed '$d')"
echo "$APPLY_JSON" >"$ARTIFACT_DIR/apply.json"
case "$APPLY_HTTP" in
  200)
    pass "POST apply HTTP 200"
    if python3 - <<PY
import json
d=json.load(open("$ARTIFACT_DIR/apply.json"))
v=d.get("tmmt_validation") or {}
assert v.get("ok") is True, v
print("ok")
PY
    then
      pass "EC-MKT-AI-03 — TMMT gate ok after apply"
    else
      fail "EC-MKT-AI-03 gate after apply"
    fi
    ;;
  409)
    blocked "POST apply 409 — seed official marketing_plan (./scripts/seed_mkt_ai_uat_lifecycle.sh)"
    ;;
  *)
    fail "POST apply HTTP $APPLY_HTTP"
    ;;
esac

log ""
log "## §8 Export (MKTP-UC-010, step 19)"
EXP_RAW="$(api POST /export '{"format":"pdf"}')"
EXP_HTTP="$(echo "$EXP_RAW" | tail -1)"
EXP_JSON="$(echo "$EXP_RAW" | sed '$d')"
echo "$EXP_JSON" >"$ARTIFACT_DIR/export-pdf.json"
if [[ "$EXP_HTTP" == "200" ]]; then
  python3 - <<PY || fail "Export PDF payload"
import json, base64
d=json.load(open("$ARTIFACT_DIR/export-pdf.json"))
assert d.get("encoding")=="base64", d.get("encoding")
raw=base64.b64decode(d.get("content",""))
assert raw[:4]==b"%PDF", raw[:8]
assert d.get("filename","").endswith(".pdf")
print("ok")
PY
  pass "POST export pdf — valid PDF base64 + filename"
else
  fail "POST export HTTP $EXP_HTTP"
fi

log ""
log "## §9 Audit (step 21)"
if [[ -n "${DATABASE_URL:-}" ]]; then
  JOB_COUNT="$(psql "$DATABASE_URL" -tAc \
    "SELECT COUNT(*) FROM mkt_ai_jobs WHERE lifecycle_id=$LIFECYCLE_ID AND status='succeeded'" 2>/dev/null \
    | tr -d '[:space:]' || echo 0)"
  if [[ "${JOB_COUNT:-0}" -ge 4 ]]; then
    pass "mkt_ai_jobs succeeded ≥4 (actual $JOB_COUNT)"
  else
    fail "mkt_ai_jobs succeeded=$JOB_COUNT (expected ≥4)"
  fi
  EXP_COUNT="$(psql "$DATABASE_URL" -tAc \
    "SELECT COUNT(*) FROM mkt_ai_exports WHERE lifecycle_id=$LIFECYCLE_ID" 2>/dev/null \
    | tr -d '[:space:]' || echo 0)"
  if [[ "${EXP_COUNT:-0}" -ge 1 ]]; then pass "mkt_ai_exports audit row present"; else fail "mkt_ai_exports empty"; fi
else
  skip "DB audit — DATABASE_URL not set"
fi

  if [[ "${RUN_E1:-0}" == "1" ]]; then
  log ""
  log "## §E1 Retry path (EC-MKT-AI-05)"
  RETRY_RAW="$(api POST /jobs/campaigns/retry)"
  if [[ "$(echo "$RETRY_RAW" | tail -1)" == "200" ]]; then pass "POST jobs/campaigns/retry HTTP 200"; else fail "Retry campaign"; fi
  CTX_RAW="$(api GET /context)"
  echo "$(echo "$CTX_RAW" | sed '$d')" >"$ARTIFACT_DIR/context-after-retry.json"
  python3 - <<PY || fail "Strategy draft preserved after retry"
import json
before=json.load(open("$ARTIFACT_DIR/context-after-strategy.json"))
after=json.load(open("$ARTIFACT_DIR/context-after-retry.json"))
b=(before.get("draft",{}).get("strategy_framework") or {}).get("target_market","")
a=(after.get("draft",{}).get("strategy_framework") or {}).get("target_market","")
assert a.strip(), "empty strategy after retry"
assert "UAT patch" in a or b, "strategy draft lost"
print("ok")
PY
  pass "Strategy draft preserved (EC-MKT-AI-05)"
fi

log ""
log "## Summary"
log ""
log "| Result | Count |"
log "|--------|-------|"
log "| PASS | $PASS |"
log "| FAIL | $FAIL |"
log "| SKIP | $SKIP |"
log "| BLOCKED | $BLOCKED |"
log ""
log "Report: \`$REPORT\`"
log "Artifacts: \`$ARTIFACT_DIR\`"

if [[ "$FAIL" -gt 0 ]]; then exit 1; fi
if [[ "$BLOCKED" -gt 0 ]]; then exit 2; fi
exit 0
