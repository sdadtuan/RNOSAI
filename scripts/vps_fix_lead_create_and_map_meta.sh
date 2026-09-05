#!/usr/bin/env bash
# VPS: patch lead create SQL fix, map Meta page+forms to ptt-pilot, verify.
set -euo pipefail
ROOT="/var/www/rnosai"
API_DIR="$ROOT/services/ptt-crm-api"
PATCH_FILE="$ROOT/scripts/pg-leads-write.repository.patch.ts"

cd "$ROOT"
source .env

echo "=== 1. Build ptt-crm-api (lead create fix) ==="
if [[ -f "$PATCH_FILE" ]]; then
  cp "$PATCH_FILE" "$API_DIR/src/leads/pg-leads-write.repository.ts"
fi
cd "$API_DIR"
npm run build --silent 2>/dev/null || npm run build
sudo systemctl restart ptt-crm-api
sleep 3
systemctl is-active ptt-crm-api

echo "=== 2. Fetch Meta leadgen forms + map to ptt-pilot ==="
cd "$ROOT" && set -a && source .env && set +a
cd "$API_DIR"

TOKEN=$(node -e "
const { Pool } = require('pg');
const { decryptAccessToken } = require('./dist/agency/token-vault.util.js');
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const r = await pool.query(\"SELECT access_token_encrypted FROM client_channel_accounts WHERE channel='meta' AND status='active' ORDER BY updated_at DESC LIMIT 1\");
  const t = decryptAccessToken(r.rows[0].access_token_encrypted);
  if (!t) process.exit(2);
  process.stdout.write(t);
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
" 2>/dev/null || true)

PAGE_ID=1222371747615610
PROJECT_CODE=ptt-pilot
PROJ_ID=$(psql "$DATABASE_URL" -tAc "SELECT id::text FROM crm_b2b_projects WHERE code='${PROJECT_CODE}'")

psql "$DATABASE_URL" -c "INSERT INTO crm_b2b_project_pages (project_id, page_id, name, active) VALUES ('${PROJ_ID}'::uuid, '${PAGE_ID}', 'PTT ads Facebook Page', TRUE)" 2>/dev/null \
  || psql "$DATABASE_URL" -c "UPDATE crm_b2b_project_pages SET project_id='${PROJ_ID}'::uuid, name='PTT ads Facebook Page', active=TRUE WHERE page_id='${PAGE_ID}';"

PAGE_ROW=$(psql "$DATABASE_URL" -tAc "SELECT id::text FROM crm_b2b_project_pages WHERE page_id='${PAGE_ID}' AND active LIMIT 1")

if [[ -n "${TOKEN:-}" ]]; then
  curl -sf "https://graph.facebook.com/v21.0/${PAGE_ID}/leadgen_forms?fields=id,name,status&limit=50&access_token=${TOKEN}" -o /tmp/meta_forms.json
  python3 <<PY
import json, os, subprocess
db = os.environ["DATABASE_URL"]
page_row = """$PAGE_ROW"""
data = json.load(open("/tmp/meta_forms.json"))
if data.get("error"):
    raise SystemExit("GRAPH: " + str(data["error"]))
for f in data.get("data", []):
    if f.get("status") == "ARCHIVED":
        continue
    fid = str(f["id"])
    name = str(f.get("name") or fid).replace("'", "''")
    subprocess.run(["psql", db, "-c", f"INSERT INTO crm_b2b_project_page_forms (page_row_id, form_id, name, active) VALUES ('{page_row}'::uuid, '{fid}', '{name}', TRUE)"], check=False)
    subprocess.run(["psql", db, "-c", f"UPDATE crm_b2b_project_page_forms SET page_row_id='{page_row}'::uuid, name='{name}', active=TRUE WHERE form_id='{fid}'"], check=False)
    print("mapped form", fid, name)
PY
else
  echo "WARN: Meta token unavailable — page mapped, forms skipped (refresh token then re-run)"
fi

echo "=== 3. Verify mapped channels ==="
psql "$DATABASE_URL" -c "
SELECT p.code, pg.page_id, f.form_id, f.name, f.active
FROM crm_b2b_projects p
JOIN crm_b2b_project_pages pg ON pg.project_id = p.id
LEFT JOIN crm_b2b_project_page_forms f ON f.page_row_id = pg.id
WHERE p.code = 'ptt-pilot';
"

echo "=== 4. Smoke create lead with project ==="
PROJ=$(psql "$DATABASE_URL" -tAc "SELECT id::text FROM crm_b2b_projects WHERE code='ptt-pilot'")
code=$(curl -s -o /tmp/b2b_create.json -w '%{http_code}' -X POST http://127.0.0.1:3000/api/v1/leads \
  -H "x-ptt-internal-key: ${PTT_CRM_INTERNAL_KEY}" \
  -H 'Content-Type: application/json' \
  -d "{\"full_name\":\"Pilot API Test\",\"phone\":\"0900111333\",\"lead_flow_kind\":\"b2b_prospect\",\"b2b_project_id\":\"${PROJ}\",\"owner_company_id\":\"a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11\",\"source\":\"manual\"}")
echo "HTTP ${code}"
cat /tmp/b2b_create.json
echo
echo "=== 5. Webhook URL for Meta (update in Meta Business Suite) ==="
echo "https://rs.pttads.vn/api/v1/webhooks/meta/ptt-pilot"
