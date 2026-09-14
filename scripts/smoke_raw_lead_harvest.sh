#!/usr/bin/env bash
# Smoke / acceptance checklist for Market Research Raw Lead Harvest (SRS v1.5).
#
# Usage:
#   bash scripts/smoke_raw_lead_harvest.sh
#   API_BASE=https://rs.pttads.vn bash scripts/smoke_raw_lead_harvest.sh
#
# Env flags (VPS):
#   PTT_RESEARCH_RAW_LEAD_HARVEST=1
#   NEXT_PUBLIC_RESEARCH_RAW_LEAD_HARVEST=1   (ops-web build-time)
#   PTT_RESEARCH_HARVEST_MOCK=0|1
#   PTT_RESEARCH_HARVEST_LEGAL_ENRICH=0|1    (optional H3c)
#   PTT_SECRET_ENCRYPT_KEY                   (encrypt Admin tokens)
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
OPS_BASE="${OPS_BASE:-http://127.0.0.1:3200}"
fail=0

ok() { echo " OK  $*"; }
warn() { echo "WARN $*"; }
bad() { echo "FAIL $*"; fail=1; }

echo "== Raw Lead Harvest smoke @ $(date -u +%Y-%m-%dT%H:%M:%SZ) =="
echo " API_BASE=${API_BASE}"
echo " OPS_BASE=${OPS_BASE}"
echo

echo "== 1) Health =="
if curl -sf "${API_BASE}/health" -o /tmp/rnosai-api-health.json; then
  ok "api /health"
else
  bad "api /health unreachable"
fi
if curl -sf "${OPS_BASE}/login" -o /dev/null; then
  ok "ops-web /login"
else
  warn "ops-web /login unreachable (ok if checking API-only)"
fi

echo
echo "== 2) Feature flags (local process env if present) =="
for key in PTT_RESEARCH_RAW_LEAD_HARVEST PTT_RESEARCH_HARVEST_MOCK NEXT_PUBLIC_RESEARCH_RAW_LEAD_HARVEST PTT_SECRET_ENCRYPT_KEY; do
  if [[ -n "${!key:-}" ]]; then
    if [[ "$key" == PTT_SECRET_ENCRYPT_KEY ]]; then
      ok "${key}=<set len=${#PTT_SECRET_ENCRYPT_KEY}>"
    else
      ok "${key}=${!key}"
    fi
  else
    warn "${key} not in this shell (check VPS .env / runtime.env)"
  fi
done

echo
echo "== 3) Manual acceptance matrix (SRS / plan Task 13) =="
cat <<'EOF'
 [ ] 1  Admin CRUD industry/job_title reflects harvest dropdowns
 [ ] 2  Province from VN Geo only
 [ ] 3  ≥1 source required; channels optional
 [ ] 4  Provider+model from Admin; disabled hidden
 [ ] 5  Token list shows hint only (never plaintext)
 [ ] 6  Rotate + Test connection
 [ ] 7  Quality job: no evidence → not pending
 [ ] 8  0123456789 not phone_ok
 [ ] 9  google.com/search evidence → auto_reject
 [ ] 10 Pass B: phone absent in HTML → null
 [ ] 11 bad_phone → blacklist; next harvest skips
 [ ] 12 push CRM rejects contactable=false
 [ ] 13 Logs never contain API token
 [ ] 14 Delete lookup/provider/model/credential referenced by harvest job → HTTP 409
EOF

echo
echo "== 4) Suggested automated tests =="
echo " cd services/ptt-crm-api && npx jest src/market-research/raw-lead-harvest/ -i --no-coverage"
echo " cd services/ptt-crm-api && npx jest src/crm-config/crm-config-pg.repository.spec.ts -i --no-coverage"

echo
if [[ "$fail" -eq 0 ]]; then
  echo "== smoke probe OK (complete checklist manually) =="
  exit 0
fi
echo "== smoke probe FAILED =="
exit 1
