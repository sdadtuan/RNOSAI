#!/usr/bin/env bash
# Deploy Media Supply & Outcome OS W1+WIN — DDL + build only.
# Do NOT export PTT_MEDIA_OS_ENABLED=1 or NEXT_PUBLIC_MEDIA_OS=1 unless pilot UAT on staging.
# Do NOT seed partners/inventory/IO — staff creates real rows on UI after flag on.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_msos_w1_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_msos_w1_vps.sh --local
#
# Pilot UAT runbook (manual, staging only):
#   1. Grant crm_media.* to pilot staff via Admin IAM.
#   2. Set PTT_MEDIA_OS_ENABLED=1 and NEXT_PUBLIC_MEDIA_OS=1 on staging only.
#   3. Open /crm/media-os — 8 screens empty until staff creates inventory + booking.
#   4. Walk spine: package → reserve → IO → traffic → Live → evidence official → finance request.
#   5. Turn flags off — nav hidden, /api/crm/media-os/health returns media_os_disabled.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  echo "== MSOS W1+WIN deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
  cd "$ROOT"

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== 0/4 apply MSOS W1+WIN DDL (schema only, no business seed) =="
  bash "$ROOT/scripts/apply_pg_ddl_msos_w1_win.sh"

  echo "== 1/4 ptt-crm-api build + MSOS unit tests =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  npm run build
  npx jest src/msos/ --forceExit --no-coverage

  echo "== 2/4 ops-web MSOS unit tests =="
  cd "$ROOT/services/ops-web"
  npm ci
  npx vitest run src/lib/crm/msos

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

  echo ""
  echo "================================================================"
  echo "  Do NOT set PTT_MEDIA_OS_ENABLED / NEXT_PUBLIC_MEDIA_OS"
  echo "  unless pilot UAT on staging. No catalog seed was applied."
  echo "================================================================"
  echo "OK  MSOS W1+WIN deployed (flags remain off by default)"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
  exit 0
fi

if [[ "$APPLY" != "1" ]]; then
  echo "Dry run. Set APPLY=1 to deploy to $VPS_USER@$VPS_HOST:$VPS_ROOT"
  exit 0
fi

ssh "$VPS_USER@$VPS_HOST" "cd '$VPS_ROOT' && git pull --ff-only origin main && bash scripts/deploy_msos_w1_vps.sh --local"
