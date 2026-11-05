#!/usr/bin/env bash
# Grant crm_kpi_groups caps to leadership roles.
#
# Positions:
#   SUPER-ADMIN, CEO, GD — view, manage, configure, export
#
# Usage:
#   ./scripts/seed_kpi_groups_rbac.sh          # dry-run
#   ./scripts/seed_kpi_groups_rbac.sh --apply
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
  ('crm_kpi_groups', 'view'),
  ('crm_kpi_groups', 'manage'),
  ('crm_kpi_groups', 'configure'),
  ('crm_kpi_groups', 'export')
) AS g(section_id, action)
WHERE lower(trim(p.code)) IN ('super-admin', 'ceo', 'gd')
ON CONFLICT (position_id, section_id, action) DO NOTHING;
SQL
}

echo "== KPI Groups RBAC caps =="

if [[ "$APPLY" != "--apply" ]]; then
  echo "Dry-run — see scripts/seed_kpi_groups_rbac.sh for grants"
  echo ""
  echo "Current crm_kpi_groups grants:"
  psql "$DATABASE_URL" -c "
    SELECT p.code, s.section_id, s.action
    FROM staff_section_permissions s
    JOIN crm_positions p ON p.id = s.position_id
    WHERE s.section_id = 'crm_kpi_groups'
    ORDER BY 1, 2, 3
    LIMIT 40;
  " 2>/dev/null || echo "(query failed — section may not exist yet)"
  echo ""
  echo "Run: $0 --apply"
  exit 0
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<<"$(grant_sql)"

echo "OK  crm_kpi_groups caps applied — đăng xuất / đăng nhập lại để menu cập nhật"
psql "$DATABASE_URL" -c "
  SELECT p.code, s.section_id, s.action
  FROM staff_section_permissions s
  JOIN crm_positions p ON p.id = s.position_id
  WHERE s.section_id = 'crm_kpi_groups'
  ORDER BY 1, 2, 3;
"
