#!/usr/bin/env bash
# Deploy Account Management OS — Wave 1–4 DDL + ptt-crm-api + ops-web.
# Do NOT export AM_AI_ENABLED=1 — AI draft stays off unless ops set it later.
# Do NOT grant crm_am caps here — seed_am_rbac.sh is catalog-only.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_am_os_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_am_os_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  echo "== AM OS deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
  cd "$ROOT"

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== 0/5 apply AM DDL (W1–W4) =="
  bash "$ROOT/scripts/apply_pg_ddl_am.sh"
  bash "$ROOT/scripts/apply_pg_ddl_am_w2.sh"
  bash "$ROOT/scripts/apply_pg_ddl_am_w3.sh"
  bash "$ROOT/scripts/apply_pg_ddl_am_w4.sh"

  echo "== 1/5 AM RBAC catalog (no user grants) =="
  bash "$ROOT/scripts/seed_am_rbac.sh"

  echo "== 2/5 ptt-crm-api build + AM tests =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  npm run build
  npx jest --testPathPattern='src/am' --no-coverage

  echo "== 3/5 ops-web AM unit tests =="
  cd "$ROOT/services/ops-web"
  npm ci
  npm run test:unit -- src/lib/crm/am-

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
      if systemctl is-active --quiet ptt-ops-web 2>/dev/null; then
        pid="$(systemctl show ptt-ops-web -p MainPID --value 2>/dev/null || true)"
        if [[ -n "$pid" && "$pid" != "0" ]] && kill -HUP "$pid" 2>/dev/null; then
          sleep 3
          systemctl is-active ptt-ops-web && echo "OK  ptt-ops-web restarted via HUP (deploy user)"
        else
          echo "      Run: sudo systemctl restart ptt-crm-api ptt-ops-web"
        fi
      else
        echo "      Run: sudo systemctl restart ptt-crm-api ptt-ops-web"
      fi
      echo "      Without restart, ops-web may serve stale sidebar until restarted."
    fi
  fi

  echo "OK  AM OS deployed (AM_AI_ENABLED not enabled; grant crm_am via Admin RBAC)"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
  exit 0
fi

if [[ "$APPLY" != "1" ]]; then
  echo "Dry run. Set APPLY=1 to deploy to $VPS_USER@$VPS_HOST:$VPS_ROOT"
  exit 0
fi

ssh "$VPS_USER@$VPS_HOST" "cd '$VPS_ROOT' && git pull --ff-only origin main && bash scripts/deploy_am_os_vps.sh --local"
