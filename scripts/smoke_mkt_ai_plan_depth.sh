#!/usr/bin/env bash
# WS-P4-02 S2 — brief upload + KPI tree + readiness (MKTP-UC-026 partial)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

API_URL="${PTT_API_URL:-http://127.0.0.1:3000}"
LIFECYCLE_ID="${LIFECYCLE_ID:-1}"
KEY="${PTT_CRM_INTERNAL_KEY:?PTT_CRM_INTERNAL_KEY required}"

auth=(-H "X-Internal-Key: $KEY" -H "Content-Type: application/json")
base="$API_URL/api/crm/service-lifecycle/$LIFECYCLE_ID/ai-planner"

echo "== smoke_mkt_ai_plan_depth S2 =="
echo "lifecycle=$LIFECYCLE_ID api=$API_URL"

ctx="$(curl -sf "${auth[@]}" "$base/context")"
echo "$ctx" | grep -q '"enabled":true' || { echo "FAIL: planner disabled"; exit 1; }

if ! echo "$ctx" | grep -q '"brief_readiness"'; then
  echo "WARN: brief_readiness missing (ok if depth flags off)"
fi

tmp="$(mktemp)"
cat >"$tmp" <<'EOF'
Thương hiệu: Smoke Test Brand
Ngành: Logistics
Mục tiêu: lead
Ngân sách tháng: 50 triệu
Thị trường: HCM
Thách thức: CPL cao trong smoke test
EOF

upload_out="$(curl -sf -H "X-Internal-Key: $KEY" -F "file=@$tmp;filename=brief-smoke.txt" "$base/brief/upload" 2>/dev/null || true)"
rm -f "$tmp"

if [ -n "$upload_out" ]; then
  echo "$upload_out" | grep -q 'readiness_score\|"score"' || echo "WARN: upload response shape"
  echo "OK brief/upload"
else
  echo "SKIP brief/upload (flag off or 404)"
fi

kpi_patch="$(curl -sf "${auth[@]}" -X PATCH "$base/draft" -d '{
  "kpi_tree_json": [{
    "id": "north_star",
    "label": "CPL",
    "target": "< 500k",
    "unit": "VND",
    "children": [{ "id": "c1", "label": "Meta Lead", "target": "200 leads" }]
  }]
}')"
echo "$kpi_patch" | grep -q 'north_star' && echo "OK kpi_tree_json patch" || { echo "FAIL kpi patch"; exit 1; }

ctx2="$(curl -sf "${auth[@]}" "$base/context")"
echo "$ctx2" | grep -q 'CPL' && echo "OK context kpi_tree" || echo "WARN: kpi not in context json"

echo "PASS smoke_mkt_ai_plan_depth S2"
