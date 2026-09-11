#!/usr/bin/env bash
# Deploy Content Marketing OS Wave E4 (competitive win) — DDL + ptt-crm-api + ops-web.
# Do NOT enable direct_social_publish or CP_AI_ENABLED — Graph publish stays default off.
# Do NOT seed Sunlight/Nova/Tâm An.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_cmkte_e4_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_cmkte_e4_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  echo "== CMKT-E4 deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
  cd "$ROOT"

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== 0/5 apply CMKT-E4 WIN DDL =="
  bash "$ROOT/scripts/apply_pg_ddl_cmkt_e4_win.sh"

  echo "== 1/5 ptt-crm-api build + focused E4 tests =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  npm run build
  node node_modules/jest/bin/jest.js \
    src/content-os-portfolio/e4-acceptance.spec.ts \
    src/content-os-portfolio/content-os-portfolio.service.execute.spec.ts \
    src/content-os-portfolio/facebook-page-connector.spec.ts \
    --no-coverage --forceExit

  echo "== 2/5 ops-web focused E4 tests =="
  cd "$ROOT/services/ops-web"
  npm ci
  npx vitest run src/lib/crm/cmkte-win-acceptance.spec.ts src/lib/crm/cmkte-win-publish.spec.ts

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

  echo "== 5/5 HEAD =="
  git -C "$ROOT" rev-parse HEAD
  echo "OK  CMKT-E4 deployed (direct_social_publish off; CP_AI_ENABLED not set)"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
  exit 0
fi

if [[ "$APPLY" != "1" ]]; then
  echo "Dry run. Set APPLY=1 to deploy to $VPS_USER@$VPS_HOST:$VPS_ROOT"
  exit 0
fi

ssh "$VPS_USER@$VPS_HOST" "cd '$VPS_ROOT' && git pull --ff-only origin main && bash scripts/deploy_cmkte_e4_vps.sh --local"
