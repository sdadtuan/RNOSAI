#!/usr/bin/env bash
# Deploy Creative Production OS Wave 1+2+3+4 — DDL + catalog + ptt-crm-api + ops-web.
# Do NOT export CP_AI_ENABLED=1 — render stays stub until UAT signoff is green.
# Do NOT grant crm_cp caps here — seed_cp_rbac.sh is catalog-only.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_cp_os_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_cp_os_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  echo "== CP OS deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
  cd "$ROOT"

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== 0/5 apply CP Wave 1 + Wave 2 + Wave 3 + Wave 4 DDL =="
  bash "$ROOT/scripts/apply_pg_ddl_cp.sh"
  bash "$ROOT/scripts/apply_pg_ddl_cp_w2.sh"
  bash "$ROOT/scripts/apply_pg_ddl_cp_w3.sh"
  bash "$ROOT/scripts/apply_pg_ddl_cp_w4.sh"

  echo "== 1/5 CP RBAC catalog (no user grants) =="
  bash "$ROOT/scripts/seed_cp_rbac.sh"

  echo "== 1b/5 import CP projects from Dự án PTT =="
  bash "$ROOT/scripts/seed_cp_projects_from_b2b.sh"

  if [[ "${SEED_CP_PLAYBOOKS:-0}" == "1" ]]; then
    echo "== 1c/5 seed Industry Playbooks (Phase A) =="
    bash "$ROOT/scripts/seed_cp_playbooks_phase_a.sh"
  fi
  if [[ "${SEED_CP_DEMO:-0}" == "1" ]]; then
    echo "== 1d/5 demo seed The Peak =="
    bash "$ROOT/scripts/seed_cp_demo_the_peak.sh"
  fi

  echo "== 2/5 ptt-crm-api build + CP unit tests =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  npm run build
  npx jest --config jest.config.js src/cp --forceExit --no-coverage

  echo "== 3/5 ops-web CP unit tests =="
  cd "$ROOT/services/ops-web"
  npm ci
  npx vitest run src/lib/crm/cp-*.spec.ts src/lib/crm/cp-*.util.spec.ts src/lib/auth.spec.ts

  echo "== 4/5 ops-web build =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  "$ROOT/scripts/deploy_ops_web.sh" build

  echo "== 5/5 restart services (one unit per command) =="
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

  echo "OK  CP OS deployed (CP_AI_ENABLED not enabled; grant crm_cp via Admin RBAC)"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
  exit 0
fi

if [[ "$APPLY" != "1" ]]; then
  echo "Dry run. Set APPLY=1 to deploy to $VPS_USER@$VPS_HOST:$VPS_ROOT"
  exit 0
fi

ssh "$VPS_USER@$VPS_HOST" "cd '$VPS_ROOT' && git pull --ff-only origin main && bash scripts/deploy_cp_os_vps.sh --local"
