#!/usr/bin/env bash
# Idempotent seed: publish 3 Phase A playbook templates (BĐS / Lead / TVC).
# Requires staff token with crm_cp.edit. Set SEED_CP_PLAYBOOKS=1 in deploy to run.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ -f "$ROOT/.env" ]]; then set -a; source "$ROOT/.env"; set +a; fi

API_URL="${OPS_E2E_API_URL:-http://127.0.0.1:3000}"
API_URL="${API_URL%/}"
EMAIL="${CP_SEED_STAFF_EMAIL:-${OPS_E2E_STAFF_EMAIL:-staff@demo.local}}"
PASSWORD="${CP_SEED_STAFF_PASSWORD:-${OPS_E2E_STAFF_PASSWORD:-demo12345}}"

REQUIRED_VARS='["project_name","price_from","location","cta","hotline"]'

login_json="$(curl -sf -X POST "$API_URL/api/v1/staff/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")"
TOKEN="$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['access_token'])" "$login_json")"

seed_template() {
  local name="$1"
  local rules_json="$2"
  local existing
  existing="$(curl -sf "$API_URL/api/crm/cp/templates" \
    -H "Authorization: Bearer $TOKEN" \
    | python3 -c "
import json,sys
name=sys.argv[1].lower()
items=json.load(sys.stdin).get('items') or []
for row in items:
    if str(row.get('name','')).lower()==name and row.get('status')=='published':
        print(row.get('id',''))
        break
" "$name" || true)"
  if [[ -n "$existing" ]]; then
    echo "SKIP  $name (published id=$existing)"
    return 0
  fi
  local created
  created="$(curl -sf -X POST "$API_URL/api/crm/cp/templates" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"name\":\"$name\",\"variables_json\":$REQUIRED_VARS,\"rules_json\":$rules_json}")"
  local id
  id="$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['id'])" "$created")"
  curl -sf -X POST "$API_URL/api/crm/cp/templates/$id/publish" \
    -H "Authorization: Bearer $TOKEN" >/dev/null
  echo "OK    $name published (id=$id)"
}

echo "== Seed CP Phase A playbook templates =="
seed_template 'bds-social-916' '{"ratio":"9:16","duration_sec":15,"line":"PL-1"}'
seed_template 'lead-social-916' '{"ratio":"9:16","duration_sec":15,"line":"PL-2","extra_vars":["hook_id","offer","primary_text"]}'
seed_template 'tvc-short-169' '{"ratio":"16:9","duration_sec":30,"line":"PL-3","extra_vars":["brand_name","tagline","legal_disclaimer"]}'
echo "Done. GET /api/crm/cp/playbooks should resolve template_id for each slug."
