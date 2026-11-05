#!/usr/bin/env bash
# Deploy Intake Deal Bar + Sales Kit S0–S2 (ptt-crm-api + ops-web).
# No DDL. Kit UI on by default; LLM stays off unless NEXT_PUBLIC_PTT_INTAKE_SALES_KIT_LLM=1.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_intake_deal_bar_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_intake_deal_bar_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  echo "== Intake Deal Bar + Sales Kit deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
  cd "$ROOT"

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== 1/3 ptt-crm-api build + intake tests =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  npm run build
  npm test -- --testPathPattern='src/intake/intake-definitions.util.spec|src/intake/intake-context.util.spec|src/intake/intake-sales-kit-rules.util.spec' --no-coverage

  echo "== 2/3 ops-web build =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  export NEXT_PUBLIC_PTT_INTAKE_SALES_KIT="${NEXT_PUBLIC_PTT_INTAKE_SALES_KIT:-1}"
  "$ROOT/scripts/deploy_ops_web.sh" build
  cd "$ROOT/services/ops-web"
  npx vitest run \
    src/lib/crm/intake-service-resolve.spec.ts \
    src/lib/crm/intake-workspace-tab.spec.ts \
    src/lib/crm/intake-session-form.spec.ts \
    src/lib/crm/intake-win-intel.spec.ts \
    src/lib/crm/intake-sales-kit-apply.spec.ts

  echo "== 3/3 restart services =="
  sudo -n /usr/bin/systemctl restart ptt-crm-api 2>/dev/null || true
  sleep 3
  curl -sf http://127.0.0.1:3000/health -o /dev/null && echo " api OK" || echo "WARN  api health check failed"

  sudo -n /usr/bin/systemctl restart ptt-ops-web 2>/dev/null || true
  sleep 2
  curl -sf http://127.0.0.1:3200/login -o /dev/null && echo " ops-web OK" || echo "WARN  ops-web health check failed"

  echo "== Intake Deal Bar + Sales Kit deploy complete =="
  echo "UAT: https://rs.pttads.vn/crm/intake?lead_id=5"
  echo "LLM kit stays off unless NEXT_PUBLIC_PTT_INTAKE_SALES_KIT_LLM=1"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_intake_deal_bar_vps.sh --local"
else
  echo "Dry-run. Set APPLY=1 to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Or on VPS: bash scripts/deploy_intake_deal_bar_vps.sh --local"
fi
