#!/usr/bin/env bash
# Deploy KPI Types — DDL + RBAC seed + ptt-crm-api tests + ops-web build.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_kpi_types_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_kpi_types_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  echo "== KPI Types deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
  cd "$ROOT"

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== 0/5 apply KPI Types DDL =="
  bash "$ROOT/scripts/apply_pg_ddl_kpi_types.sh"

  echo "== 1/5 seed KPI Types RBAC =="
  bash "$ROOT/scripts/seed_kpi_types_rbac.sh" --apply

  echo "== 2/5 ptt-crm-api build + kpi-types tests =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  npm run build
  npx jest --testPathPattern='src/kpi-types' --no-coverage

  echo "== 3/5 ops-web unit (kpi-types) =="
  cd "$ROOT/services/ops-web"
  npm ci
  npm run test:unit -- src/lib/kpi-type-form.util.spec.ts src/lib/kpi-types-api.spec.ts

  echo "== 4/5 ops-web build =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  "$ROOT/scripts/deploy_ops_web.sh" build

  echo "== 5/5 restart services (local systemd if present) =="
  if command -v systemctl >/dev/null 2>&1; then
    if sudo -n systemctl restart ptt-crm-api ptt-ops-web 2>/dev/null; then
      sleep 2
      systemctl is-active ptt-crm-api ptt-ops-web
    else
      echo "WARN  sudo systemctl restart skipped"
      echo "      Run: sudo systemctl restart ptt-crm-api ptt-ops-web"
    fi
  fi

  echo "OK  KPI Types deployed"
  echo ""
  echo "Optional E2E (staff needs crm_kpi_types caps):"
  echo "  cd services/ops-web && npm run test:e2e:kpi-types"
  echo "User guide: docs/huong-dan-su-dung/32-kpi-type.md"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
  exit 0
fi

if [[ "$APPLY" != "1" ]]; then
  echo "Dry run. Set APPLY=1 to deploy to $VPS_USER@$VPS_HOST:$VPS_ROOT"
  exit 0
fi

ssh "$VPS_USER@$VPS_HOST" "cd '$VPS_ROOT' && git pull --ff-only origin main && bash scripts/deploy_kpi_types_vps.sh --local"
