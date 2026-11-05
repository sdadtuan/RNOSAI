#!/usr/bin/env bash
# Verify Magnific Flow sqid via REST API (server-side only — never call from browser).
#
# Usage:
#   MAGNIFIC_REST_KEY='...' ./scripts/verify_cp_magnific_flow_sqid.sh
#   MAGNIFIC_REST_KEY='...' FLOW_SQID='uqzQLDr2Aw' ./scripts/verify_cp_magnific_flow_sqid.sh
#
# On VPS (key in crm_cp_provider_connections — use psql + decrypt in app, or pass env):
#   MAGNIFIC_REST_KEY='...' bash scripts/verify_cp_magnific_flow_sqid.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${MAGNIFIC_REST_BASE:-https://api.magnific.com}"
KEY="${MAGNIFIC_REST_KEY:-}"

if [[ -z "$KEY" ]]; then
  echo "FAIL  Set MAGNIFIC_REST_KEY (Magnific REST API key, server-side only)." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "FAIL  jq required." >&2
  exit 1
fi

auth=(-H "X-Magnific-Api-Key: ${KEY}")

echo "== GET ${BASE}/v1/ai/flows =="
flows_json="$(curl -sS "${auth[@]}" "${BASE}/v1/ai/flows")"
echo "$flows_json" | jq '.data[]? | {sqid, name, total_cost}' 2>/dev/null || {
  echo "$flows_json" | jq '.' 2>/dev/null || echo "$flows_json"
  exit 1
}

SQID="${FLOW_SQID:-}"
if [[ -z "$SQID" ]]; then
  echo ""
  echo "Tip: FLOW_SQID='...' to verify one flow definition + inputs."
  exit 0
fi

echo ""
echo "== GET ${BASE}/v1/ai/flows/${SQID} =="
detail_json="$(curl -sS "${auth[@]}" "${BASE}/v1/ai/flows/${SQID}")"
echo "$detail_json" | jq '{sqid, name, total_cost, inputs: .inputs // .data.inputs}' 2>/dev/null || {
  echo "$detail_json" | jq '.' 2>/dev/null || echo "$detail_json"
  exit 1
}

echo ""
echo "OK  sqid ${SQID} reachable. Update seed: scripts/seed_cp_magnific_flow_templates_staging.sql"
