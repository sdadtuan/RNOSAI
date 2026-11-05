#!/usr/bin/env bash
# Apply bàn giao RBAC seed on VPS (psql — no psycopg2 required).
#
#   ./scripts/seed_rnosai_handover_rbac.sh          # dry-run counts
#   ./scripts/seed_rnosai_handover_rbac.sh --apply
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi
: "${DATABASE_URL:?DATABASE_URL required}"

SQL="$ROOT/scripts/data/rnosai_handover_rbac_seed.sql"
if [[ ! -f "$SQL" ]]; then
  echo "Missing $SQL — run: python3 scripts/export_rnosai_handover_rbac_sql.py"
  exit 1
fi

echo "== Handover RBAC seed =="
psql "$DATABASE_URL" -c "
  SELECT p.code, COUNT(s.*) AS grants
  FROM crm_positions p
  LEFT JOIN staff_section_permissions s ON s.position_id = p.id
  WHERE p.active
  GROUP BY 1 ORDER BY 1;
"

if [[ "${1:-}" != "--apply" ]]; then
  echo "Dry-run. Run: $0 --apply"
  exit 0
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SQL"
echo "OK  seeded — Admin → Phân quyền để xem; đăng xuất/đăng nhập lại."
psql "$DATABASE_URL" -c "
  SELECT p.code, COUNT(s.*) AS grants
  FROM crm_positions p
  LEFT JOIN staff_section_permissions s ON s.position_id = p.id
  WHERE p.active
  GROUP BY 1 ORDER BY 1;
"
