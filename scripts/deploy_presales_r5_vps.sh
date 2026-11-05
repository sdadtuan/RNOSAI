#!/usr/bin/env bash
# Deploy R5 marketing-plan hydrate fix — ptt-crm-api + ops-web.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_presales_r5_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_presales_r5_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  cd "$ROOT"
  echo "== Presales R5 deploy @ $(git rev-parse --short HEAD) =="

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== ptt-crm-api build + R5 tests =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  npm run build
  npx jest --config jest.config.js \
    src/leads-funnel/presales-marketing-plan.util.spec.ts \
    src/leads-funnel/presales-proposal-gate.util.spec.ts \
    src/leads-funnel/presales-ai-draft-meta.util.spec.ts \
    --forceExit --no-coverage

  echo "== ops-web R5 tests + build =="
  cd "$ROOT/services/ops-web"
  npm ci
  npx vitest run src/lib/crm/presales-r5-plan.util.spec.ts
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  "$ROOT/scripts/deploy_ops_web.sh" build

  echo "== restart =="
  if command -v systemctl >/dev/null 2>&1; then
    for unit in ptt-crm-api ptt-ops-web; do
      if sudo -n /usr/bin/systemctl restart "$unit" 2>/dev/null; then
        echo "OK  restarted $unit"
      else
        echo "WARN  sudo restart failed for $unit"
      fi
    done
    sleep 4
    systemctl is-active ptt-crm-api
    systemctl is-active ptt-ops-web
  fi

  echo "OK  Presales R5 deployed"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
  exit 0
fi

if [[ "$APPLY" != "1" ]]; then
  echo "Dry run. Set APPLY=1 to deploy to $VPS_USER@$VPS_HOST:$VPS_ROOT"
  exit 0
fi

ssh "$VPS_USER@$VPS_HOST" "cd '$VPS_ROOT' && git pull --ff-only origin main && bash scripts/deploy_presales_r5_vps.sh --local"
