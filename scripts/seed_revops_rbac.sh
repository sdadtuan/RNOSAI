#!/usr/bin/env bash
# RevOps RBAC — catalog only. Do NOT grant production users.
#
# Caps live in services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json:
#   crm_revops:             view, view_team, view_all, manage
#   crm_revops.commission:  view, manage
#
# Grant via Admin RBAC UI after deploy. This script never INSERTs
# staff_section_permissions.
set -euo pipefail

echo "== RevOps RBAC (catalog only) =="
echo "Caps are registered in rbac-admin-catalog.json (crm_revops, crm_revops.commission)."
echo "Do not grant production users from this script."
echo "Grant via Admin → Permissions after deploy."
exit 0
