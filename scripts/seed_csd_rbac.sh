#!/usr/bin/env bash
# Grant csd.* caps for Agency Service Desk (CSD-20260902).
#
# Positions:
#   SUPER-ADMIN — all csd actions
#   GDKD        — view, write, assign, manage
#   KD-01 (AM)  — view, write
#   MKT-01      — view, write
#   Any position with crm_agency.view — view, write (agency staff)
#
# Job functions (additive via staff_job_function_grants):
#   leader    — view, write, assign, manage
#   sales     — view, write
#   content   — view, write
#   design    — view, write
#   technical — view, write
#   ops       — view
#   analyst   — view
#
# Usage:
#   ./scripts/seed_csd_rbac.sh          # dry-run
#   ./scripts/seed_csd_rbac.sh --apply
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
-- SUPER-ADMIN — all
INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, g.section_id, g.action
FROM crm_positions p
CROSS JOIN (VALUES
  ('csd', 'view'),
  ('csd', 'write'),
  ('csd', 'assign'),
  ('csd', 'manage'),
  ('csd', 'admin')
) AS g(section_id, action)
WHERE lower(trim(p.code)) = 'super-admin'
ON CONFLICT (position_id, section_id, action) DO NOTHING;

-- GDKD — PM / leader tier
INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, g.section_id, g.action
FROM crm_positions p
CROSS JOIN (VALUES
  ('csd', 'view'),
  ('csd', 'write'),
  ('csd', 'assign'),
  ('csd', 'manage')
) AS g(section_id, action)
WHERE lower(trim(p.code)) = 'gdkd'
ON CONFLICT (position_id, section_id, action) DO NOTHING;

-- AM (KD-01)
INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, g.section_id, g.action
FROM crm_positions p
CROSS JOIN (VALUES
  ('csd', 'view'),
  ('csd', 'write')
) AS g(section_id, action)
WHERE lower(trim(p.code)) = 'kd-01'
ON CONFLICT (position_id, section_id, action) DO NOTHING;

-- Marketing lead stand-in
INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, g.section_id, g.action
FROM crm_positions p
CROSS JOIN (VALUES
  ('csd', 'view'),
  ('csd', 'write')
) AS g(section_id, action)
WHERE lower(trim(p.code)) = 'mkt-01'
ON CONFLICT (position_id, section_id, action) DO NOTHING;

-- Agency module users inherit SD ticket workspace
INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT DISTINCT s.position_id, g.section_id, g.action
FROM staff_section_permissions s
CROSS JOIN (VALUES
  ('csd', 'view'),
  ('csd', 'write')
) AS g(section_id, action)
WHERE s.section_id = 'crm_agency' AND s.action = 'view'
ON CONFLICT (position_id, section_id, action) DO NOTHING;

-- Job function grants (additive for users with assigned functions)
INSERT INTO staff_job_function_grants (function_code, section_id, action)
VALUES
  ('leader', 'csd', 'view'),
  ('leader', 'csd', 'write'),
  ('leader', 'csd', 'assign'),
  ('leader', 'csd', 'manage'),
  ('sales', 'csd', 'view'),
  ('sales', 'csd', 'write'),
  ('content', 'csd', 'view'),
  ('content', 'csd', 'write'),
  ('design', 'csd', 'view'),
  ('design', 'csd', 'write'),
  ('technical', 'csd', 'view'),
  ('technical', 'csd', 'write'),
  ('ops', 'csd', 'view'),
  ('analyst', 'csd', 'view')
ON CONFLICT (function_code, section_id, action) DO NOTHING;
SQL
}

echo "== CSD Service Desk RBAC caps =="

if [[ "$APPLY" != "--apply" ]]; then
  echo "Dry-run — see scripts/seed_csd_rbac.sh for grants"
  echo ""
  echo "Current csd grants:"
  psql "$DATABASE_URL" -c "
    SELECT p.code, s.section_id, s.action
    FROM staff_section_permissions s
    JOIN crm_positions p ON p.id = s.position_id
    WHERE s.section_id = 'csd'
    ORDER BY 1, 2, 3
    LIMIT 40;
  " 2>/dev/null || echo "(query failed)"
  echo ""
  echo "Run: $0 --apply"
  exit 0
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<<"$(grant_sql)"

echo "OK  csd caps applied — đăng xuất / đăng nhập lại để menu cập nhật"
psql "$DATABASE_URL" -c "
  SELECT p.code, s.section_id, s.action
  FROM staff_section_permissions s
  JOIN crm_positions p ON p.id = s.position_id
  WHERE s.section_id = 'csd'
  ORDER BY 1, 2, 3
  LIMIT 40;
"
