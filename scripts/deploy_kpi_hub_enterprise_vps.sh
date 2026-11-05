#!/usr/bin/env bash
# Deploy KPI Hub Enterprise SRS v1.2 — Command Centers + Delivery (F0–E).
#
# From laptop:
#   APPLY=1 ./scripts/deploy_kpi_hub_enterprise_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_kpi_hub_enterprise_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  echo "== KPI Hub Enterprise deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
  cd "$ROOT"

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== 0/7 apply Delivery DDL (4 files) =="
  bash "$ROOT/scripts/apply_pg_ddl_delivery_projects.sh"

  echo "== 1/7 seed KPI Hub RBAC =="
  bash "$ROOT/scripts/seed_kpi_hub_rbac.sh" --apply

  echo "== 2/7 seed Delivery RBAC =="
  bash "$ROOT/scripts/seed_delivery_rbac.sh" --apply

  echo "== 3/7 backfill delivery headers from B2B (idempotent) =="
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
    INSERT INTO crm_delivery_projects (
      id, tenant_id, name, capabilities, b2b_project_id, status, pm_staff_id, start_date, end_date, created_at, updated_at
    )
    SELECT
      gen_random_uuid(),
      'PTT',
      b.name,
      ARRAY['lead_ingest']::text[],
      b.id,
      CASE b.status WHEN 'active' THEN 'active' WHEN 'paused' THEN 'on_hold' WHEN 'archived' THEN 'closed' ELSE 'draft' END,
      COALESCE(b.created_by_staff_id, 1),
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '365 days',
      now(),
      now()
    FROM crm_b2b_projects b
    WHERE NOT EXISTS (
      SELECT 1 FROM crm_delivery_projects d WHERE d.b2b_project_id = b.id AND d.deleted_at IS NULL
    );
  " 2>/dev/null || echo "WARN  backfill skipped (table may not exist yet or already done)"

  echo "== 4/7 ptt-crm-api build + tests =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  npm run build
  npx jest --testPathPattern='src/kpi-hub|src/delivery-projects' --no-coverage

  echo "== 5/7 ops-web unit tests =="
  cd "$ROOT/services/ops-web"
  npm ci
  npm run test:unit -- \
    src/lib/kpi-hub-nav.spec.ts \
    src/lib/command-center.util.spec.ts \
    src/lib/delivery-projects.util.spec.ts \
    src/lib/delivery-budget.util.spec.ts \
    src/lib/delivery-kpi-picker.util.spec.ts

  echo "== 6/7 ops-web build =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  "$ROOT/scripts/deploy_ops_web.sh" build

  echo "== 7/7 restart services =="
  if command -v systemctl >/dev/null 2>&1; then
    if sudo -n systemctl restart ptt-crm-api ptt-ops-web 2>/dev/null; then
      sleep 3
      systemctl is-active ptt-crm-api ptt-ops-web
    else
      echo "WARN  sudo systemctl restart skipped — run on VPS:"
      echo "      sudo systemctl restart ptt-crm-api ptt-ops-web"
    fi
  fi

  echo "OK  KPI Hub Enterprise deployed"
  echo "Routes: /crm/kpi-hub/executive · /marketing · /sales · /crm/delivery-projects"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
  exit 0
fi

if [[ "$APPLY" != "1" ]]; then
  echo "Dry run. Set APPLY=1 to deploy to $VPS_USER@$VPS_HOST:$VPS_ROOT"
  exit 0
fi

ssh "$VPS_USER@$VPS_HOST" "cd '$VPS_ROOT' && git pull --ff-only origin main && bash scripts/deploy_kpi_hub_enterprise_vps.sh --local"
