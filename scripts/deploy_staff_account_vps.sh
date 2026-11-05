#!/usr/bin/env bash
# Deploy Staff Account Self-Service (Gói C): DDL + ptt-crm-api + ops-web.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_staff_account_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_staff_account_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  echo "== Staff Account deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
  cd "$ROOT"

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== 0/5 apply staff sessions + avatar DDL =="
  bash "$ROOT/scripts/apply_pg_ddl_staff_sessions.sh"

  echo "== 1/5 avatar storage dir =="
  mkdir -p "$ROOT/services/ptt-crm-api/data/staff-avatars"

  echo "== 2/5 ptt-crm-api build + staff-auth tests =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  npm run build
  npx jest src/staff-auth --no-coverage

  echo "== 3/5 ops-web build =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  "$ROOT/scripts/deploy_ops_web.sh" build

  echo "== 4/5 restart services (local systemd if present) =="
  if command -v systemctl >/dev/null 2>&1; then
    if sudo -n systemctl restart ptt-crm-api ptt-ops-web 2>/dev/null; then
      sleep 2
      systemctl is-active ptt-crm-api ptt-ops-web
    else
      echo "WARN  service restart skipped (sudo required)"
      echo "      Run: sudo systemctl restart ptt-crm-api ptt-ops-web"
    fi
  fi

  echo "== 5/5 smoke =="
  curl -sf "${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}/health" >/dev/null && echo "API health OK"
  curl -sfI "${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}/login" | head -1

  echo "OK  Staff Account Self-Service deployed"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
  exit 0
fi

if [[ "$APPLY" != "1" ]]; then
  echo "Dry run. Set APPLY=1 to deploy to $VPS_USER@$VPS_HOST:$VPS_ROOT"
  exit 0
fi

ssh "$VPS_USER@$VPS_HOST" "cd '$VPS_ROOT' && git pull --ff-only origin main && bash scripts/deploy_staff_account_vps.sh --local"
