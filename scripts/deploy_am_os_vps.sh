#!/usr/bin/env bash
# Deploy Account Management OS — Wave 1–4 + G1 DDL + ptt-crm-api + ops-web.
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

  echo "== 0/6 apply AM DDL (W1–W4 + G1) =="
  bash "$ROOT/scripts/apply_pg_ddl_am.sh"
  bash "$ROOT/scripts/apply_pg_ddl_am_w2.sh"
  bash "$ROOT/scripts/apply_pg_ddl_am_w3.sh"
  bash "$ROOT/scripts/apply_pg_ddl_am_w4.sh"
  bash "$ROOT/scripts/apply_pg_ddl_am_g1.sh"

  echo "== 1/6 AM RBAC catalog (no user grants) =="
  bash "$ROOT/scripts/seed_am_rbac.sh"

  echo "== 2/6 ptt-crm-api build + AM tests =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  npm run build
  npx jest --config jest.config.js src/am --forceExit --no-coverage

  echo "== 3/6 ops-web AM unit tests =="
  cd "$ROOT/services/ops-web"
  npm ci
  npx vitest run src/lib/crm/am-*.spec.ts src/lib/crm/am-*.util.spec.ts src/lib/auth.spec.ts

  echo "== 4/6 ops-web build =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  "$ROOT/scripts/deploy_ops_web.sh" build

  echo "== 5/6 restart services (one unit per command) =="
  if command -v systemctl >/dev/null 2>&1; then
    # sudoers allows one unit per command, not "restart a b"
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

  echo "== 6/6 install AM health + renewal timers =="
  bash "$ROOT/scripts/check_am_job_units.sh"
  if command -v systemctl >/dev/null 2>&1; then
    installed=0
    for unit in \
      ptt-crm-am-health.service \
      ptt-crm-am-health.timer \
      ptt-crm-am-renewal.service \
      ptt-crm-am-renewal.timer
    do
      if sudo -n /usr/bin/cp "$ROOT/deploy/systemd/$unit" "/etc/systemd/system/$unit" 2>/dev/null; then
        echo "OK  installed $unit"
        installed=1
      else
        echo "WARN  could not copy $unit"
      fi
    done
    if [[ "$installed" == "1" ]]; then
      sudo -n /usr/bin/systemctl daemon-reload || echo "WARN  daemon-reload failed"
      if sudo -n /usr/bin/systemctl enable --now ptt-crm-am-health.timer 2>/dev/null; then
        echo "OK  enabled ptt-crm-am-health.timer"
      else
        echo "WARN  enable ptt-crm-am-health.timer failed"
      fi
      if sudo -n /usr/bin/systemctl enable --now ptt-crm-am-renewal.timer 2>/dev/null; then
        echo "OK  enabled ptt-crm-am-renewal.timer"
      else
        echo "WARN  enable ptt-crm-am-renewal.timer failed"
      fi
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
