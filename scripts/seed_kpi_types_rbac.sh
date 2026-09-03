#!/usr/bin/env bash
# Grant crm_kpi_types caps to leadership roles.
#
# Positions:
#   SUPER-ADMIN, CEO, GD — view, manage, configure, export
#
# Usage:
#   ./scripts/seed_kpi_types_rbac.sh          # dry-run
#   ./scripts/seed_kpi_types_rbac.sh --apply
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
  ('crm_kpi_types', 'view'),
  ('crm_kpi_types', 'manage'),
  ('crm_kpi_types', 'configure'),
  ('crm_kpi_types', 'export')
) AS g(section_id, action)
WHERE lower(trim(p.code)) IN ('super-admin', 'ceo', 'gd')
ON CONFLICT (position_id, section_id, action) DO NOTHING;
SQL
}

echo "== KPI Types RBAC caps =="

if [[ "$APPLY" != "--apply" ]]; then
  echo "Dry-run — see scripts/seed_kpi_types_rbac.sh for grants"
  echo ""
  echo "Current crm_kpi_types grants:"
  psql "$DATABASE_URL" -c "
    SELECT p.code, s.section_id, s.action
    FROM staff_section_permissions s
    JOIN crm_positions p ON p.id = s.position_id
    WHERE s.section_id = 'crm_kpi_types'
    ORDER BY 1, 2, 3
    LIMIT 40;
  " 2>/dev/null || echo "(query failed — section may not exist yet)"
  echo ""
  echo "Run: $0 --apply"
  exit 0
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<<"$(grant_sql)"

echo "OK  crm_kpi_types caps applied — đăng xuất / đăng nhập lại để menu cập nhật"
psql "$DATABASE_URL" -c "
  SELECT p.code, s.section_id, s.action
  FROM staff_section_permissions s
  JOIN crm_positions p ON p.id = s.position_id
  WHERE s.section_id = 'crm_kpi_types'
  ORDER BY 1, 2, 3;
"
