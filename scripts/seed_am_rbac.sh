#!/usr/bin/env bash
# Account Management RBAC — catalog only. Do NOT grant production users.
#
# Caps live in services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json:
#   crm_am:          view, view_all, edit, assign, manage
#   crm_am.finance:  view
#
# Grant via Admin RBAC UI after deploy. This script never INSERTs
# staff_section_permissions.
set -euo pipefail

echo "== AM RBAC (catalog only) =="
echo "Caps are registered in rbac-admin-catalog.json (crm_am, crm_am.finance)."
echo "Do not grant production users from this script."
echo "Grant via Admin → Permissions after deploy."
exit 0
