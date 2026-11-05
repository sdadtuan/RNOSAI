#!/usr/bin/env bash
# Seed RevOps W3 commission demo data — plans, tiers, transactions, payout batch.
#
# Usage:
#   ./scripts/seed_revops_commission_demo.sh          # dry-run (show counts)
#   ./scripts/seed_revops_commission_demo.sh --apply
#
# On VPS:
#   cd /var/www/rnosai && bash scripts/seed_revops_commission_demo.sh --apply
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL required}"

SEED="$ROOT/docs/specs/2026-09-06-seed-revops-commission-demo.sql"
APPLY="${1:-}"

echo "== RevOps commission demo seed =="

if [[ "$APPLY" != "--apply" ]]; then
  echo "Dry-run — pass --apply to INSERT"
  echo ""
  psql "$DATABASE_URL" -c "
    SELECT 'plans' AS kind, count(*)::text AS n FROM crm_revops_commission_plans WHERE tenant_id = 'PTT'
    UNION ALL
    SELECT 'tiers', count(*)::text FROM crm_revops_commission_tiers t
      JOIN crm_revops_commission_plans p ON p.id = t.plan_id WHERE p.tenant_id = 'PTT'
    UNION ALL
    SELECT 'transactions', count(*)::text FROM crm_revops_commission_transactions WHERE tenant_id = 'PTT'
    UNION ALL
    SELECT 'payout_batches', count(*)::text FROM crm_revops_payout_batches WHERE tenant_id = 'PTT';
  " 2>/dev/null || echo "(tables may not exist — run apply_pg_ddl_revops_w3.sh first)"
  exit 0
fi

echo "==> Ensure RevOps W3 DDL =="
bash "$ROOT/scripts/apply_pg_ddl_revops_w3.sh"

echo "==> Apply commission demo seed =="
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SEED"

echo ""
echo "OK  RevOps commission demo seed applied"
psql "$DATABASE_URL" -c "
  SELECT name, version, role_code, status
  FROM crm_revops_commission_plans
  WHERE tenant_id = 'PTT'
  ORDER BY name, version;
"
psql "$DATABASE_URL" -c "
  SELECT status, count(*) AS n, sum(commission_vnd)::bigint AS total_vnd
  FROM crm_revops_commission_transactions
  WHERE tenant_id = 'PTT'
  GROUP BY status
  ORDER BY 1;
"
