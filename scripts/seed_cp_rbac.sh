#!/usr/bin/env bash
# Creative Production OS RBAC — catalog only. Do NOT grant production users.
#
# Caps live in services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json:
#   crm_cp:                   view, view_all, edit, manage
#   crm_cp.render:            execute
#   crm_cp.render_high_cost:  execute
#   crm_cp.export_final:      execute
#   crm_cp.publish:           execute
#   crm_cp.brand:             edit
#   crm_cp.manage_brand_rule: manage
#   crm_cp.approve_legal:     execute
#   crm_cp.finance:           view
#   crm_cp.view_audit:        view
#
# Grant via Admin RBAC UI after deploy. This script never INSERTs
# staff_section_permissions.
set -euo pipefail

echo "== Creative Production OS RBAC (catalog only) =="
echo "Caps are registered in rbac-admin-catalog.json (crm_cp and scoped crm_cp.* sections)."
echo "Do not grant production users from this script."
echo "Grant via Admin → Permissions after deploy."
exit 0
