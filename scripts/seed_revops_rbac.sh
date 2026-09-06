#!/usr/bin/env bash
# Grant crm_revops caps for Revenue Operations shell (REVOPS-ENT W1).
#
# Persona map (SRS / plan B1):
#   view       — AE, individual sales
#   view_team  — Team Lead / ACM
#   view_all   — Sales Director (CEO, PD on PTT org)
#   manage     — Admin (SUPER-ADMIN)
#
# Job functions (additive via staff_user_job_functions):
#   leader  — view_team
#   sales   — view
#   analyst — view
#
# Usage:
#   ./scripts/seed_revops_rbac.sh          # dry-run
#   ./scripts/seed_revops_rbac.sh --apply
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
-- SUPER-ADMIN — full RevOps
INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, g.section_id, g.action
FROM crm_positions p
CROSS JOIN (VALUES
  ('crm_revops', 'view'),
  ('crm_revops', 'view_team'),
  ('crm_revops', 'view_all'),
  ('crm_revops', 'manage')
) AS g(section_id, action)
WHERE lower(trim(p.code)) = 'super-admin'
ON CONFLICT (position_id, section_id, action) DO NOTHING;

-- CEO / PD — Sales Director tier (view_all)
INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, g.section_id, g.action
FROM crm_positions p
CROSS JOIN (VALUES
  ('crm_revops', 'view'),
  ('crm_revops', 'view_all')
) AS g(section_id, action)
WHERE lower(trim(p.code)) IN ('ceo', 'pd')
ON CONFLICT (position_id, section_id, action) DO NOTHING;

-- ACM — Account Manager / team lead (view_team)
INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, g.section_id, g.action
FROM crm_positions p
CROSS JOIN (VALUES
  ('crm_revops', 'view'),
  ('crm_revops', 'view_team')
) AS g(section_id, action)
WHERE lower(trim(p.code)) = 'acm'
ON CONFLICT (position_id, section_id, action) DO NOTHING;

-- AE — Account Executive (view)
INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, 'crm_revops', 'view'
FROM crm_positions p
WHERE lower(trim(p.code)) = 'ae'
ON CONFLICT (position_id, section_id, action) DO NOTHING;

-- Legacy / staging sales director codes when present
INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, g.section_id, g.action
FROM crm_positions p
CROSS JOIN (VALUES
  ('crm_revops', 'view'),
  ('crm_revops', 'view_all')
) AS g(section_id, action)
WHERE lower(trim(p.code)) IN ('gdkd', 'kd-01', 'sales-director', 'revops')
ON CONFLICT (position_id, section_id, action) DO NOTHING;

-- Job function grants (additive)
INSERT INTO staff_job_function_grants (function_code, section_id, action)
VALUES
  ('leader', 'crm_revops', 'view'),
  ('leader', 'crm_revops', 'view_team'),
  ('sales', 'crm_revops', 'view'),
  ('analyst', 'crm_revops', 'view')
ON CONFLICT (function_code, section_id, action) DO NOTHING;
SQL
}

echo "== RevOps RBAC grants (crm_revops) =="

if [[ "$APPLY" != "--apply" ]]; then
  echo "Dry-run — pass --apply to INSERT"
  echo ""
  echo "Current crm_revops position grants:"
  psql "$DATABASE_URL" -c "
    SELECT p.code, s.section_id, s.action
    FROM staff_section_permissions s
    JOIN crm_positions p ON p.id = s.position_id
    WHERE s.section_id = 'crm_revops'
    ORDER BY 1, 3;
  " 2>/dev/null || echo "(query failed)"
  echo ""
  echo "Job function grants:"
  psql "$DATABASE_URL" -c "
    SELECT function_code, section_id, action
    FROM staff_job_function_grants
    WHERE section_id = 'crm_revops'
    ORDER BY 1, 2;
  " 2>/dev/null || echo "(query failed)"
  exit 0
fi

grant_sql | psql "$DATABASE_URL" -v ON_ERROR_STOP=1

echo ""
echo "Applied. Summary:"
psql "$DATABASE_URL" -c "
  SELECT p.code, string_agg(s.action, ', ' ORDER BY s.action) AS crm_revops_actions
  FROM staff_section_permissions s
  JOIN crm_positions p ON p.id = s.position_id
  WHERE s.section_id = 'crm_revops'
  GROUP BY p.code
  ORDER BY p.code;
"
