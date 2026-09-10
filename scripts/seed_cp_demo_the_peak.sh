#!/usr/bin/env bash
# Demo seed: "The Peak — Launch Q3" portfolio for Creative OS mockup tour.
# Compose: playbook templates + CP project + deliverables + optional SOP ingest.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ -f "$ROOT/.env" ]]; then set -a; source "$ROOT/.env"; set +a; fi

API_URL="${OPS_E2E_API_URL:-http://127.0.0.1:3000}"
API_URL="${API_URL%/}"
EMAIL="${CP_SEED_STAFF_EMAIL:-${OPS_E2E_STAFF_EMAIL:-staff@demo.local}}"
PASSWORD="${CP_SEED_STAFF_PASSWORD:-${OPS_E2E_STAFF_PASSWORD:-demo12345}}"
PROJECT_NAME="${CP_DEMO_PROJECT_NAME:-The Peak — Launch Q3}"
CLIENT_NAME="${CP_DEMO_CLIENT_NAME:-The Peak}"
TOKEN="${CP_SEED_TOKEN:-${STAFF_JWT:-${CRM_STAFF_TOKEN:-}}}"

echo "== CP demo seed: The Peak =="
echo "Env flags:"
echo "  SEED_CP_DEMO=1       — run automated seed steps"
echo "  SEED_CP_PLAYBOOKS=1  — publish 3 playbook templates"
echo "  CP_SEED_TOKEN        — skip login when staff JWT already available"
echo ""

if [[ "${SEED_CP_DEMO:-0}" != "1" ]]; then
  cat <<'SQL'
Manual SQL fallback (when API token unavailable):

-- 1) Client
INSERT INTO clients (code, name, status)
VALUES ('THE-PEAK', 'The Peak', 'active')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, updated_at = now();

-- 2) CP project (replace :client_id and :owner_staff_id)
INSERT INTO crm_cp_projects (
  tenant_id, agency_client_id, owner_staff_id, name, status, objective, tags
) VALUES (
  'PTT', :client_id::uuid, :owner_staff_id, 'The Peak — Launch Q3', 'active',
  'Demo portfolio for Creative OS Phase B', ARRAY['demo:the-peak']
)
ON CONFLICT DO NOTHING;

-- 3) Deliverables for progress bar (8/13 ≈ 62%)
INSERT INTO crm_cp_deliverables (project_id, type, status)
SELECT p.id, t.type, t.status
  FROM crm_cp_projects p
 CROSS JOIN (
   VALUES
     ('ai_video','completed'), ('ai_video','completed'), ('ai_video','completed'),
     ('social','completed'), ('social','completed'), ('motion','completed'),
     ('landing_asset','completed'), ('human_video','completed'),
     ('ai_video','in_review'), ('social','draft'), ('motion','queued'),
     ('landing_asset','rendering'), ('human_video','draft')
 ) AS t(type, status)
 WHERE p.name = 'The Peak — Launch Q3'
   AND NOT EXISTS (
     SELECT 1 FROM crm_cp_deliverables d WHERE d.project_id = p.id
   );
SQL
  echo ""
  echo "Set SEED_CP_DEMO=1 to run automated API seed."
  exit 0
fi

echo "Step 1/4: playbook templates"
"$ROOT/scripts/seed_cp_playbooks_phase_a.sh"

if [[ -z "$TOKEN" ]]; then
  login_json="$(curl -sf -X POST "$API_URL/api/v1/staff/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")"
  TOKEN="$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['access_token'])" "$login_json")"
fi

auth_hdr=(-H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json')

lookups="$(curl -sf "$API_URL/api/crm/cp/projects/lookups" "${auth_hdr[@]}")"
client_id="$(python3 -c "
import json,sys
name=sys.argv[1].lower()
for row in json.loads(sys.argv[2]).get('clients') or []:
    if str(row.get('name','')).lower()==name:
        print(row.get('id',''))
        break
" "$CLIENT_NAME" "$lookups")"
owner_id="$(python3 -c "
import json,sys
staff=json.loads(sys.argv[1]).get('staff') or []
print(staff[0]['id'] if staff else '')
" "$lookups")"

if [[ -z "$client_id" ]]; then
  echo "WARN  client '$CLIENT_NAME' not found — create via Admin or SQL fallback above"
  exit 1
fi
if [[ -z "$owner_id" ]]; then
  echo "WARN  no active staff found for project owner"
  exit 1
fi

existing_project="$(curl -sf "$API_URL/api/crm/cp/projects?scope=all&q=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$PROJECT_NAME")" \
  "${auth_hdr[@]}" \
  | python3 -c "
import json,sys
name=sys.argv[1].lower()
for row in json.loads(sys.stdin.read()).get('items') or []:
    if str(row.get('name','')).lower()==name.lower():
        print(row.get('id',''))
        break
" "$PROJECT_NAME" || true)"

if [[ -n "$existing_project" ]]; then
  project_id="$existing_project"
  echo "SKIP  project '$PROJECT_NAME' (id=$project_id)"
else
  created="$(curl -sf -X POST "$API_URL/api/crm/cp/projects" \
    "${auth_hdr[@]}" \
    -d "{\"name\":\"$PROJECT_NAME\",\"agency_client_id\":\"$client_id\",\"owner_staff_id\":$owner_id,\"status\":\"active\",\"objective\":\"Demo portfolio for Creative OS Phase B\",\"tags\":[\"demo:the-peak\"]}")"
  project_id="$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['id'])" "$created")"
  echo "OK    project '$PROJECT_NAME' (id=$project_id)"
fi

seed_deliverable() {
  local type="$1"
  local status="$2"
  curl -sf -X POST "$API_URL/api/crm/cp/projects/$project_id/deliverables" \
    "${auth_hdr[@]}" \
    -d "{\"type\":\"$type\",\"status\":\"$status\"}" >/dev/null
}

deliverable_count="$(curl -sf "$API_URL/api/crm/cp/projects/$project_id/deliverables" "${auth_hdr[@]}" \
  | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('items') or []))")"

if [[ "${deliverable_count:-0}" -lt 5 ]]; then
  echo "Step 3/4: deliverables (target 8 done / 13 total)"
  for _ in 1 2 3; do seed_deliverable ai_video completed; done
  for _ in 1 2; do seed_deliverable social completed; done
  seed_deliverable motion completed
  seed_deliverable landing_asset completed
  seed_deliverable human_video completed
  seed_deliverable ai_video in_review
  seed_deliverable social draft
  seed_deliverable motion queued
  seed_deliverable landing_asset rendering
  seed_deliverable human_video draft
  echo "OK    deliverables seeded"
else
  echo "SKIP  deliverables already present ($deliverable_count)"
fi

demo_uri="${CP_DEMO_OUTPUT_URI:-file://${ROOT}/output/video_like_page_20s/demo.mp4}"
if [[ -f "${demo_uri#file://}" || "$demo_uri" == http* ]]; then
  echo "Step 4/4: SOP ingest stub"
  ingest="$(curl -sf -X POST "$API_URL/api/crm/cp/videos/sop-ingest" \
    "${auth_hdr[@]}" \
    -d "{\"project_id\":\"$project_id\",\"name\":\"The Peak TVC master\",\"output_uri\":\"$demo_uri\",\"playbook_id\":\"tvc_short_169\",\"facts\":{\"legal_approved\":true,\"has_claim\":true}}")"
  version_id="$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('version_id',''))" "$ingest")"
  echo "OK    sop-ingest version_id=$version_id"
else
  echo "SKIP  sop-ingest — set CP_DEMO_OUTPUT_URI to an existing MP4 path"
fi

echo "Done. Open /crm/creative-os/projects and verify progress_pct ≈ 62%."
