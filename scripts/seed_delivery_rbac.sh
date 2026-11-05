#!/usr/bin/env bash
# Grant Delivery Project + budget caps to leadership roles.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi
: "${DATABASE_URL:?DATABASE_URL required}"
APPLY="${1:-}"

grant_sql() {
  cat <<'SQL'
INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, g.section_id, g.action
FROM crm_positions p
CROSS JOIN (VALUES
  ('crm_delivery_projects', 'view'),
  ('crm_delivery_projects', 'edit'),
  ('crm_delivery_projects', 'manage'),
  ('crm_delivery_budget', 'view'),
  ('crm_delivery_budget', 'edit'),
  ('crm_delivery_budget', 'approve')
) AS g(section_id, action)
WHERE lower(trim(p.code)) IN ('super-admin', 'ceo', 'gd')
ON CONFLICT (position_id, section_id, action) DO NOTHING;
SQL
}

echo "== Delivery RBAC caps =="
if [[ "$APPLY" != "--apply" ]]; then
  echo "Run: $0 --apply"
  exit 0
fi
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<<"$(grant_sql)"
echo "OK  Delivery caps applied"
