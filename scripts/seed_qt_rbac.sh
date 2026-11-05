#!/usr/bin/env bash
# Quotation OS RBAC — catalog only. Do NOT grant production users.
#
# Caps live in services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json:
#   crm_quote:          view, view_all, edit, manage
#   crm_quote.approve:  execute
#   crm_quote.finance:  view, edit
#   crm_quote.legal:    execute
#   crm_quote.publish:  execute
#   crm_quote.convert:  execute
#   crm_quote.catalog:  view, manage
#   crm_quote.audit:    view
#
# Grant via Admin RBAC UI after deploy. This script never INSERTs
# staff_section_permissions.
# FORBIDDEN: INSERT INTO staff_section_permissions
set -euo pipefail

echo "== Quotation OS RBAC (catalog only) =="
echo "Caps are registered in rbac-admin-catalog.json (crm_quote and scoped crm_quote.* sections)."
echo "Do not grant production users from this script."
echo "Grant via Admin → Permissions after deploy."
exit 0
