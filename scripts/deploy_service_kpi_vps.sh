#!/usr/bin/env bash
# Deploy Service KPI module — DDL + tests + ops-web build.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_service_kpi_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_service_kpi_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  echo "== Service KPI deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
  cd "$ROOT"

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== 1/4 apply Service KPI DDL =="
  bash "$ROOT/scripts/apply_pg_ddl_service_kpi.sh"

  echo "== 2/4 ptt-crm-api build + service-kpi tests =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  npm run build
  npx jest --testPathPattern='src/kpi-hub/service-kpi|quote-studio.service.spec' --no-coverage

  echo "== 3/4 ops-web build =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  "$ROOT/scripts/deploy_ops_web.sh" build

  echo "== 4/4 restart services (API + ops-web required for Service KPI routes) =="
  if command -v systemctl >/dev/null 2>&1; then
    if sudo -n systemctl restart ptt-crm-api ptt-ops-web 2>/dev/null; then
      sleep 3
      systemctl is-active ptt-crm-api ptt-ops-web
      curl -sf http://127.0.0.1:3000/health >/dev/null && echo "OK  ptt-crm-api /health"
    else
      echo "WARN  sudo systemctl restart skipped — Service KPI API sẽ 404 cho đến khi restart"
      echo "      Run: sudo systemctl restart ptt-crm-api ptt-ops-web"
    fi
  fi

  echo "OK  Service KPI deployed"
  echo ""
  echo "Optional E2E:"
  echo "  cd services/ops-web && npx playwright test e2e/service-kpi-hub.spec.ts"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
  exit 0
fi

if [[ "$APPLY" != "1" ]]; then
  echo "Dry run. Set APPLY=1 to deploy to $VPS_USER@$VPS_HOST:$VPS_ROOT"
  exit 0
fi

ssh "$VPS_USER@$VPS_HOST" "cd '$VPS_ROOT' && git pull --ff-only origin main && bash scripts/deploy_service_kpi_vps.sh --local"
