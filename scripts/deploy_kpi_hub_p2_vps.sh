#!/usr/bin/env bash
# Deploy KPI Hub P2 — P2 DDL + seed + build + restart.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_kpi_hub_p2_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_kpi_hub_p2_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  echo "== KPI Hub P2 deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
  cd "$ROOT"

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== 0/6 apply KPI Hub DDL (P1 + P2) =="
  bash "$ROOT/scripts/apply_pg_ddl_kpi_hub.sh"
  bash "$ROOT/scripts/apply_pg_ddl_kpi_hub_p2.sh"

  echo "== 1/6 seed KPI Hub RBAC =="
  bash "$ROOT/scripts/seed_kpi_hub_rbac.sh" --apply

  echo "== 2/6 seed KPI Hub data =="
  bash "$ROOT/scripts/seed_kpi_hub_data.sh"

  echo "== 3/6 ptt-crm-api build + kpi-hub tests =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  npm run build
  npx jest --testPathPattern='src/kpi-hub' --no-coverage

  echo "== 4/6 ops-web unit (kpi-hub) =="
  cd "$ROOT/services/ops-web"
  npm ci
  npm run test:unit -- src/lib/kpi-hub-nav.spec.ts src/lib/kpi-hub-status.spec.ts src/lib/kpi-hub-normalize.spec.ts

  echo "== 5/6 ops-web build =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  "$ROOT/scripts/deploy_ops_web.sh" build

  echo "== 6/6 restart services =="
  if command -v systemctl >/dev/null 2>&1; then
    if sudo -n systemctl restart ptt-crm-api ptt-ops-web 2>/dev/null; then
      sleep 2
      systemctl is-active ptt-crm-api ptt-ops-web
    else
      echo "WARN  sudo systemctl restart skipped"
      echo "      Run: sudo systemctl restart ptt-crm-api ptt-ops-web"
    fi
  fi

  echo "OK  KPI Hub P2 deployed"
  echo ""
  echo "Optional E2E:"
  echo "  cd services/ops-web && npx playwright test e2e/kpi-hub-p2.spec.ts"
  echo "User guide: docs/huong-dan-su-dung/33-kpi-hub.md"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
  exit 0
fi

if [[ "$APPLY" != "1" ]]; then
  echo "Dry run. Set APPLY=1 to deploy to $VPS_USER@$VPS_HOST:$VPS_ROOT"
  exit 0
fi

ssh "$VPS_USER@$VPS_HOST" "cd '$VPS_ROOT' && git pull --ff-only origin main && bash scripts/deploy_kpi_hub_p2_vps.sh --local"
