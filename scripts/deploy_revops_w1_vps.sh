#!/usr/bin/env bash
# Deploy RevOps W1 + Lead Pipeline tab — ptt-crm-api revops module + ops-web shell.
# Flags default off; pass --enable-flags to bake NEXT_PUBLIC_REVOPS_SHELL=1 and
# NEXT_PUBLIC_LEAD_PIPELINE_TAB=1 at ops-web build (also set deploy/runtime.env on VPS).
#
# From laptop:
#   APPLY=1 ./scripts/deploy_revops_w1_vps.sh
#   APPLY=1 ./scripts/deploy_revops_w1_vps.sh --enable-flags
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_revops_w1_vps.sh --local --enable-flags
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"
ENABLE_FLAGS=0

for arg in "$@"; do
  case "$arg" in
    --enable-flags) ENABLE_FLAGS=1 ;;
  esac
done

run_local() {
  echo "== RevOps W1 deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
  cd "$ROOT"

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  if [[ "$ENABLE_FLAGS" == "1" ]]; then
    export NEXT_PUBLIC_REVOPS_SHELL=1
    export NEXT_PUBLIC_LEAD_PIPELINE_TAB=1
    echo "== flags ON: REVOPS_SHELL + LEAD_PIPELINE_TAB (build-time) =="
  fi

  echo "== 1/5 RevOps RBAC catalog (no user grants) =="
  bash "$ROOT/scripts/seed_revops_rbac.sh"

  echo "== 2/5 ptt-crm-api build + revops tests =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  npm run build
  npm run test:revops

  echo "== 3/5 ops-web unit tests (revops W1 + lead pipeline) =="
  cd "$ROOT/services/ops-web"
  npm ci
  npm run test:unit:revops-w1

  echo "== 4/5 ops-web build =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  "$ROOT/scripts/deploy_ops_web.sh" build

  echo "== 5/5 restart services =="
  if command -v systemctl >/dev/null 2>&1; then
    restarted=0
    for unit in ptt-crm-api ptt-ops-web; do
      if sudo -n /usr/bin/systemctl restart "$unit" 2>/dev/null; then
        echo "OK  restarted $unit"
        restarted=1
      else
        echo "WARN  sudo restart failed for $unit"
      fi
    done
    if [[ "$restarted" == "1" ]]; then
      sleep 4
      systemctl is-active ptt-crm-api
      systemctl is-active ptt-ops-web
    else
      echo "      Run: sudo /usr/bin/systemctl restart ptt-crm-api"
      echo "           sudo /usr/bin/systemctl restart ptt-ops-web"
    fi
  fi

  echo "OK  RevOps W1 deployed. Grant crm_revops via Admin RBAC; flags in deploy/runtime.env for rebuild."
}

REMOTE_ARGS="--local"
if [[ "$ENABLE_FLAGS" == "1" ]]; then
  REMOTE_ARGS="--local --enable-flags"
fi

if [[ "${1:-}" == "--local" ]]; then
  run_local
  exit 0
fi

if [[ "$APPLY" != "1" ]]; then
  echo "Dry run. Set APPLY=1 to deploy to $VPS_USER@$VPS_HOST:$VPS_ROOT"
  echo "Optional: --enable-flags to bake RevOps + Pipeline tab flags at build time"
  exit 0
fi

ssh "$VPS_USER@$VPS_HOST" "cd '$VPS_ROOT' && git pull --ff-only origin main && bash scripts/deploy_revops_w1_vps.sh $REMOTE_ARGS"
