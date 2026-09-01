#!/usr/bin/env bash
# Deploy Communication & Service Desk (CSD) — DDL + ptt-crm-api + ops-web.
# Do NOT export PTT_CSD_LLM=1 — AI draft stays off on 3.3 GiB VPS.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_csd_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_csd_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  echo "== CSD deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
  cd "$ROOT"

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== 0/4 apply csd DDL =="
  bash "$ROOT/scripts/apply_pg_ddl_csd.sh"

  echo "== 1/4 ptt-crm-api build + csd tests =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  npm run build
  npx jest --testPathPattern='src/csd' --no-coverage

  echo "== 2/4 ops-web build =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  "$ROOT/scripts/deploy_ops_web.sh" build

  echo "== 3/4 restart services (local systemd if present) =="
  if command -v systemctl >/dev/null 2>&1; then
    if sudo -n systemctl restart ptt-crm-api ptt-ops-web 2>/dev/null; then
      sleep 2
      systemctl is-active ptt-crm-api ptt-ops-web
    else
      echo "WARN  service restart skipped (sudo required)"
      echo "      Run: sudo systemctl restart ptt-crm-api ptt-ops-web"
      echo "      Without restart, ops-web may return 500 until restarted."
    fi
  fi

  echo "OK  CSD deployed (PTT_CSD_LLM not enabled)"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
  exit 0
fi

if [[ "$APPLY" != "1" ]]; then
  echo "Dry run. Set APPLY=1 to deploy to $VPS_USER@$VPS_HOST:$VPS_ROOT"
  exit 0
fi

ssh "$VPS_USER@$VPS_HOST" "cd '$VPS_ROOT' && git pull --ff-only origin main && bash scripts/deploy_csd_vps.sh --local"
