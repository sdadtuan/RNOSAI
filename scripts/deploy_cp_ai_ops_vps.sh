#!/usr/bin/env bash
# Deploy SPEC-CP-ACO-WIN (AI Ops tab + Weave/Magnific/Comfy code).
# Does NOT flip provider flags. Keep PTT_WEAVE / MAGNIFIC_* / COMFYUI_WORKER_ENABLED at 0
# until docs/runbooks/cp-ai-ops-vps-uat.md Wave A/B/C.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_cp_ai_ops_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_cp_ai_ops_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  echo "== CP AI Ops deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
  cd "$ROOT"

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== 0/4 apply AI Ops + Weave DDL (idempotent) =="
  bash "$ROOT/scripts/apply_pg_ddl_cp_ai_ops.sh"
  bash "$ROOT/scripts/apply_pg_ddl_cp_weave.sh"

  echo "== 1/4 ptt-crm-api build + AI Ops unit tests =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  npm run build
  npx jest --config jest.config.js --testPathPattern='src/cp/cp-(ai-ops|jobs|magnific|comfy|overview|reports|projects|render.worker|provider|weave)' --forceExit --no-coverage

  echo "== 2/4 ops-web AI Ops unit tests =="
  cd "$ROOT/services/ops-web"
  npm ci
  npx vitest run src/lib/crm/cp-ai-ops-api.spec.ts src/lib/crm/cp-ai-ops-panes.util.spec.ts src/lib/crm/cp-project-workspace.util.spec.ts src/lib/crm/cp-reports.spec.ts

  echo "== 3/4 ops-web build =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  "$ROOT/scripts/deploy_ops_web.sh" build

  echo "== 4/4 restart services (one unit per command) =="
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

  echo "OK  CP AI Ops deployed (provider flags unchanged — see docs/runbooks/cp-ai-ops-vps-uat.md)"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
  exit 0
fi

if [[ "$APPLY" != "1" ]]; then
  echo "Dry run. Set APPLY=1 to deploy to $VPS_USER@$VPS_HOST:$VPS_ROOT"
  exit 0
fi

ssh "$VPS_USER@$VPS_HOST" "cd '$VPS_ROOT' && git pull --ff-only origin main && bash scripts/deploy_cp_ai_ops_vps.sh --local"
