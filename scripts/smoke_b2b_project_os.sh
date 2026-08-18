#!/usr/bin/env bash
set -euo pipefail
API="${API_URL:-http://127.0.0.1:3000}"
code=$(curl -s -o /tmp/b2b400.json -w '%{http_code}' -X POST "$API/api/v1/leads" \
  -H "Authorization: Bearer $STAFF_TOKEN" -H 'Content-Type: application/json' \
  -d '{"full_name":"X","phone":"0900000000","lead_flow_kind":"b2b_prospect"}')
test "$code" = "400"
grep -q b2b_project_required /tmp/b2b400.json
echo OK
