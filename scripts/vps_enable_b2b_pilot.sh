#!/usr/bin/env bash
# Run on VPS: enable B2B Project OS flags + create pilot project.
set -euo pipefail
cd /var/www/rnosai
source .env

set_kv() {
  local key="$1" val="$2"
  if grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${val}|" .env
  else
    echo "${key}=${val}" >> .env
  fi
}

echo "=== 1. Update .env flags ==="
set_kv PTT_B2B_PROJECT_OS 1
set_kv PTT_LEAD_MEETING_PREP_ENABLED 1
set_kv PTT_B2B_SSE 1
grep -E '^PTT_B2B_PROJECT_OS|^PTT_LEAD_MEETING_PREP_ENABLED|^PTT_B2B_SSE' .env

echo "=== 2. Create pilot project + assign staff ==="
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO crm_b2b_projects (owner_company_id, code, name, status, manual_ingest_enabled)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'ptt-pilot',
  'Dự án Pilot B2B RNOSAI',
  'active',
  TRUE
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  status = 'active',
  manual_ingest_enabled = TRUE,
  updated_at = NOW();

WITH p AS (SELECT id FROM crm_b2b_projects WHERE code = 'ptt-pilot')
INSERT INTO crm_b2b_project_staff (project_id, staff_id, assign_enabled, sales_level, role)
SELECT p.id, s.id, TRUE, s.lvl, s.role
FROM p
CROSS JOIN (VALUES
  (1, 'a'::varchar, 'sales'::text),
  (2, 'a'::varchar, 'project_manager'::text),
  (3, 'b'::varchar, 'sales'::text)
) AS s(id, lvl, role)
ON CONFLICT (project_id, staff_id) DO UPDATE SET
  assign_enabled = EXCLUDED.assign_enabled,
  sales_level = EXCLUDED.sales_level,
  role = EXCLUDED.role;

SELECT code, status, manual_ingest_enabled FROM crm_b2b_projects ORDER BY code;

SELECT ps.staff_id, cs.email, ps.assign_enabled, ps.sales_level, ps.role
FROM crm_b2b_project_staff ps
JOIN crm_staff cs ON cs.id = ps.staff_id
JOIN crm_b2b_projects p ON p.id = ps.project_id
WHERE p.code = 'ptt-pilot'
ORDER BY ps.staff_id;
SQL

echo "=== 3. Restart ptt-crm-api ==="
sudo systemctl restart ptt-crm-api
sleep 3
systemctl is-active ptt-crm-api

echo "=== 4. Smoke B2B-01 ==="
code=$(curl -s -o /tmp/b2b_smoke.json -w '%{http_code}' -X POST http://127.0.0.1:3000/api/v1/leads \
  -H "x-ptt-internal-key: ${PTT_CRM_INTERNAL_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{"full_name":"X","phone":"0900000000","lead_flow_kind":"b2b_prospect"}')
echo "HTTP ${code}"
cat /tmp/b2b_smoke.json
echo

if [[ "$code" == "400" ]] && grep -q b2b_project_required /tmp/b2b_smoke.json; then
  echo "PASS B2B-01 — flag ON, b2b_project_required gate works"
else
  echo "WARN B2B-01 — expected 400 b2b_project_required, got HTTP ${code}"
fi

echo "=== 5. b2b-projects list ==="
curl -s -H "x-ptt-internal-key: ${PTT_CRM_INTERNAL_KEY}" http://127.0.0.1:3000/api/v1/b2b-projects | head -c 500
echo
