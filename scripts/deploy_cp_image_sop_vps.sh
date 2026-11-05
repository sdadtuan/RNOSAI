#!/usr/bin/env bash
# Deploy CP Image SOP (API + ops-web + DDL). Keeps CP_IMAGE_SOP_ENABLED=0 until UAT.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_cp_image_sop_vps.sh
#   APPLY=1 SEED=1 ./scripts/deploy_cp_image_sop_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_cp_image_sop_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"
SEED="${SEED:-0}"

run_local() {
  echo "== CP Image SOP deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
  cd "$ROOT"

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== 0/5 apply Image SOP DDL (idempotent) =="
  bash "$ROOT/scripts/apply_pg_ddl_cp_image_sop.sh"

  if [[ "$SEED" == "1" ]]; then
    echo "== 0b/5 seed Nova Image SOP =="
    bash "$ROOT/scripts/seed_cp_image_sop_nova.sh"
  fi

  echo "== 1/5 ptt-crm-api build + Image SOP unit tests =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  npm run build
  CP_IMAGE_SOP_ENABLED=0 npx jest --config jest.config.js --testPathPattern='src/cp/cp-image|src/cp/guards/staff-img|src/cp/cp-image.controller' --forceExit --no-coverage

  echo "== 2/5 ops-web Image SOP unit tests =="
  cd "$ROOT/services/ops-web"
  npm ci
  npx vitest run \
    src/lib/crm/cp-image-sop.flags.spec.ts \
    src/lib/crm/cp-image-sop-nav.util.spec.ts \
    src/components/OpsNav.image-sop.spec.ts \
    src/lib/crm/cp-nav.util.spec.ts \
    src/lib/crm/cp-project-tabs.util.spec.ts \
    src/lib/auth.spec.ts

  echo "== 3/5 ops-web build =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  "$ROOT/scripts/deploy_ops_web.sh" build

  echo "== 4/5 restart services (one unit per command) =="
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

  echo "OK  CP Image SOP deployed (CP_IMAGE_SOP_ENABLED unchanged — enable after UAT)"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
  exit 0
fi

if [[ "$APPLY" != "1" ]]; then
  echo "Dry run. Set APPLY=1 to deploy to $VPS_USER@$VPS_HOST:$VPS_ROOT"
  exit 0
fi

ssh "$VPS_USER@$VPS_HOST" "cd '$VPS_ROOT' && git pull --ff-only origin main && bash scripts/deploy_cp_image_sop_vps.sh --local"
