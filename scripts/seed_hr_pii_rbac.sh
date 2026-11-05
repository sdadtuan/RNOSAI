#!/usr/bin/env bash
# Grant crm_hr_pii.view / crm_hr_pii.edit for HR employee file PII fields.
#
# Default: SUPER-ADMIN only (position id 1).
#
# Usage:
#   export DATABASE_URL=...
#   ./scripts/seed_hr_pii_rbac.sh          # dry-run
#   ./scripts/seed_hr_pii_rbac.sh --apply
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
  ('crm_hr_pii', 'view'),
  ('crm_hr_pii', 'edit')
) AS g(section_id, action)
WHERE lower(trim(p.code)) = 'super-admin'
ON CONFLICT (position_id, section_id, action) DO NOTHING;
SQL
}

echo "== HR PII RBAC caps (crm_hr_pii) =="

if [[ "$APPLY" != "--apply" ]]; then
  echo "Dry-run — caps to grant:"
  echo "  SUPER-ADMIN: crm_hr_pii.view, crm_hr_pii.edit"
  echo ""
  echo "Current crm_hr_pii grants:"
  psql "$DATABASE_URL" -c "
    SELECT p.code, s.section_id, s.action
    FROM staff_section_permissions s
    JOIN crm_positions p ON p.id = s.position_id
    WHERE s.section_id = 'crm_hr_pii'
    ORDER BY 1, 2, 3;
  " 2>/dev/null || echo "(query failed — section may not exist yet)"
  echo ""
  echo "Run: $0 --apply"
  exit 0
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<<"$(grant_sql)"

echo "OK  crm_hr_pii caps applied"
psql "$DATABASE_URL" -c "
  SELECT p.code, s.section_id, s.action
  FROM staff_section_permissions s
  JOIN crm_positions p ON p.id = s.position_id
  WHERE s.section_id = 'crm_hr_pii'
  ORDER BY 1, 2, 3;
"
