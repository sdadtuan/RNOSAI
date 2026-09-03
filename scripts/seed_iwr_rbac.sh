#!/usr/bin/env bash
# Grant iwr.* caps for Internal Work Reporting (IWR-20260903).
#
# Usage:
#   ./scripts/seed_iwr_rbac.sh          # dry-run
#   ./scripts/seed_iwr_rbac.sh --apply
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
-- SUPER-ADMIN — all iwr
INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, g.section_id, g.action
FROM crm_positions p
CROSS JOIN (VALUES
  ('iwr', 'view'),
  ('iwr', 'write'),
  ('iwr', 'review'),
  ('iwr', 'lists'),
  ('iwr', 'schedule'),
  ('iwr', 'export'),
  ('iwr', 'manage'),
  ('iwr', 'executive'),
  ('iwr', 'bcc'),
  ('iwr', 'external')
) AS g(section_id, action)
WHERE lower(trim(p.code)) = 'super-admin'
ON CONFLICT (position_id, section_id, action) DO NOTHING;

-- CEO / GD — leadership
INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, g.section_id, g.action
FROM crm_positions p
CROSS JOIN (VALUES
  ('iwr', 'view'),
  ('iwr', 'write'),
  ('iwr', 'review'),
  ('iwr', 'lists'),
  ('iwr', 'schedule'),
  ('iwr', 'export'),
  ('iwr', 'manage'),
  ('iwr', 'executive')
) AS g(section_id, action)
WHERE lower(trim(p.code)) IN ('ceo', 'gd')
ON CONFLICT (position_id, section_id, action) DO NOTHING;

-- MD / PD — PM tier + review
INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, g.section_id, g.action
FROM crm_positions p
CROSS JOIN (VALUES
  ('iwr', 'view'),
  ('iwr', 'write'),
  ('iwr', 'review'),
  ('iwr', 'export')
) AS g(section_id, action)
WHERE lower(trim(p.code)) IN ('md', 'pd')
ON CONFLICT (position_id, section_id, action) DO NOTHING;

-- GDKD — leader tier
INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, g.section_id, g.action
FROM crm_positions p
CROSS JOIN (VALUES
  ('iwr', 'view'),
  ('iwr', 'write'),
  ('iwr', 'review'),
  ('iwr', 'export'),
  ('iwr', 'executive'),
  ('iwr', 'bcc')
) AS g(section_id, action)
WHERE lower(trim(p.code)) = 'gdkd'
ON CONFLICT (position_id, section_id, action) DO NOTHING;

-- Every active position — view + write
INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, g.section_id, g.action
FROM crm_positions p
CROSS JOIN (VALUES
  ('iwr', 'view'),
  ('iwr', 'write')
) AS g(section_id, action)
WHERE p.active = TRUE
ON CONFLICT (position_id, section_id, action) DO NOTHING;

-- Job function grants
INSERT INTO staff_job_function_grants (function_code, section_id, action)
VALUES
  ('leader', 'iwr', 'view'),
  ('leader', 'iwr', 'write'),
  ('leader', 'iwr', 'review'),
  ('sales', 'iwr', 'view'),
  ('sales', 'iwr', 'write'),
  ('content', 'iwr', 'view'),
  ('content', 'iwr', 'write'),
  ('design', 'iwr', 'view'),
  ('design', 'iwr', 'write'),
  ('technical', 'iwr', 'view'),
  ('technical', 'iwr', 'write'),
  ('ops', 'iwr', 'view'),
  ('analyst', 'iwr', 'view')
ON CONFLICT (function_code, section_id, action) DO NOTHING;
SQL
}

echo "== IWR RBAC caps =="

if [[ "$APPLY" != "--apply" ]]; then
  echo "Dry-run — see scripts/seed_iwr_rbac.sh for grants"
  echo "Run: $0 --apply"
  exit 0
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<<"$(grant_sql)"
echo "OK  iwr caps applied — đăng xuất / đăng nhập lại để menu cập nhật"
