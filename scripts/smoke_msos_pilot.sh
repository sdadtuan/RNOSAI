#!/usr/bin/env bash
# MSOS pilot smoke — health + catalog (requires staff JWT with crm_media:view)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="${PTT_API_URL:-http://127.0.0.1:3000}"
EMAIL="${ADMIN_EMAIL:-${OPS_E2E_STAFF_EMAIL:-admin@pttads.vn}}"
PASS="${ADMIN_PASSWORD:-${OPS_E2E_STAFF_PASSWORD:-}}"

if [[ -z "${STAFF_TOKEN:-}" ]]; then
  if [[ -z "$PASS" ]]; then
    echo "SKIP smoke — set STAFF_TOKEN or ADMIN_PASSWORD"
    exit 0
  fi
  STAFF_TOKEN=$(curl -sf -X POST "$API/api/v1/staff/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")
fi

if [[ -z "$STAFF_TOKEN" ]]; then
  echo "FAIL staff login"
  exit 1
fi

auth=(-H "Authorization: Bearer $STAFF_TOKEN")

echo "== GET /api/crm/media-os/health =="
health=$(curl -sf "${auth[@]}" "$API/api/crm/media-os/health")
echo "$health" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('ok') is True, d"
echo "OK health"

for ep in partners inventory placements packages media-lines; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "${auth[@]}" "$API/api/crm/media-os/$ep")
  if [[ "$code" != "200" ]]; then
    echo "FAIL GET $ep HTTP $code"
    exit 1
  fi
  echo "OK GET $ep"
done

echo "OK MSOS pilot smoke"
