#!/usr/bin/env bash
# Grant crm_cp caps to demo staff — NON-PROD / manual VPS step.
# Usage: STAFF_EMAIL=staff@demo.local APPLY=1 ./scripts/grant_cp_demo_caps.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EMAIL="${STAFF_EMAIL:-staff@demo.local}"
APPLY="${APPLY:-0}"

CAPS=(
  crm_cp.view
  crm_cp.edit
  crm_cp.render
  crm_cp.export_final
  crm_cp.publish
  crm_cp.brand
  crm_cp.manage
)

echo "Target staff: $EMAIL"
echo "Caps: ${CAPS[*]}"

if [[ "$APPLY" != "1" ]]; then
  echo "Dry-run. Set APPLY=1 to grant via Admin RBAC or SQL on VPS."
  exit 0
fi

echo "Grant caps manually in Admin → Permissions for $EMAIL (catalog from scripts/seed_cp_rbac.sh)."
