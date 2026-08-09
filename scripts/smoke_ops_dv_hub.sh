#!/usr/bin/env bash
set -euo pipefail

CRM_API="${CRM_API:-http://127.0.0.1:3001}"
TOKEN="${STAFF_TOKEN:?STAFF_TOKEN required}"
LIFECYCLE_ID="${LIFECYCLE_ID:?LIFECYCLE_ID required}"

echo "==> GET /api/ops/catalog"
COUNT=$(curl -sf -H "Authorization: Bearer $TOKEN" "$CRM_API/api/ops/catalog" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).services.length')
if [ "$COUNT" != "21" ]; then
  echo "FAIL expected 21 services, got $COUNT"
  exit 1
fi

echo "==> GET /api/ops/lifecycle/$LIFECYCLE_ID/hub"
curl -sf -H "Authorization: Bearer $TOKEN" \
  "$CRM_API/api/ops/lifecycle/$LIFECYCLE_ID/hub" \
  | node -pe 'const b=JSON.parse(require("fs").readFileSync(0,"utf8")); if(!b.dv?.dv_code) process.exit(1); console.log("dv", b.dv.dv_code, "engines", b.engines?.length ?? 0)'

echo "OK smoke_ops_dv_hub"
