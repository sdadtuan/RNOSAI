#!/usr/bin/env bash
# Grant KPI Hub section caps to leadership roles.
#
# Positions:
#   SUPER-ADMIN, CEO, GD — full Hub caps (view/manage/configure/publish/send)
#
# Usage:
#   ./scripts/seed_kpi_hub_rbac.sh          # dry-run
#   ./scripts/seed_kpi_hub_rbac.sh --apply
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
  ('crm_kpi_hub', 'view'),
  ('crm_kpi_dictionary', 'view'),
  ('crm_kpi_dictionary', 'manage'),
  ('crm_kpi_dictionary', 'publish'),
  ('crm_kpi_hub_targets', 'view'),
  ('crm_kpi_hub_targets', 'manage'),
  ('crm_kpi_hub_sources', 'view'),
  ('crm_kpi_hub_sources', 'configure'),
  ('crm_kpi_quality', 'view'),
  ('crm_kpi_quality', 'manage'),
  ('crm_kpi_quality', 'export'),
  ('crm_kpi_hub_reports', 'view'),
  ('crm_kpi_hub_reports', 'manage'),
  ('crm_kpi_hub_reports', 'approve'),
  ('crm_kpi_hub_reports', 'send'),
  ('crm_kpi_hub_settings', 'view'),
  ('crm_kpi_hub_settings', 'manage')
) AS g(section_id, action)
WHERE lower(trim(p.code)) IN ('super-admin', 'ceo', 'gd')
ON CONFLICT (position_id, section_id, action) DO NOTHING;
SQL
}

echo "== KPI Hub RBAC caps =="

if [[ "$APPLY" != "--apply" ]]; then
  echo "Dry-run — see scripts/seed_kpi_hub_rbac.sh for grants"
  echo ""
  echo "Current crm_kpi_hub grants:"
  psql "$DATABASE_URL" -c "
    SELECT p.code, s.section_id, s.action
    FROM staff_section_permissions s
    JOIN crm_positions p ON p.id = s.position_id
    WHERE s.section_id LIKE 'crm_kpi_hub%' OR s.section_id IN ('crm_kpi_dictionary', 'crm_kpi_quality')
    ORDER BY 1, 2, 3
    LIMIT 60;
  " 2>/dev/null || echo "(query failed — sections may not exist yet)"
  echo ""
  echo "Run: $0 --apply"
  exit 0
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<<"$(grant_sql)"

echo "OK  KPI Hub caps applied — đăng xuất / đăng nhập lại để menu cập nhật"
