#!/usr/bin/env bash
# Deploy Intake Sales Kit S4 (DDL + ptt-crm-api + ops-web).
# Applies sales_kit_files schema, then builds API/ops-web.
#
# S3 (LLM wording + Tóm tắt 30s): do NOT auto-patch runtime here.
# Default stays off. To enable on VPS after this script, set by hand then
# rebuild ops-web + restart API — never export these to 1 in this script:
#   PTT_INTAKE_SALES_KIT_LLM=1
#   NEXT_PUBLIC_PTT_INTAKE_SALES_KIT_LLM=1
#   AI_LLM_API_KEY / PTT_AI_LLM_API_KEY=<key>
# LLM stays off unless those env vars are already present on the host.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_intake_sales_kit_s4_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_intake_sales_kit_s4_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  echo "== Intake Sales Kit S4 deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
  cd "$ROOT"

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== 0/5 apply sales_kit_files + learn DDL =="
  bash "$ROOT/scripts/apply_pg_ddl_sales_kit_files.sh"
  bash "$ROOT/scripts/apply_pg_ddl_sales_kit_learn.sh"

  echo "== 1/5 ptt-crm-api build + intake/library tests =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  npm run build
  npm test -- --testPathPattern='src/intake/intake-definitions.util.spec|src/intake/intake-context.util.spec|src/intake/intake-sales-kit-rules.util.spec|src/intake/intake-sales-kit-llm|src/intake/sales-kit-ingest|src/intake/sales-kit-retrieve|src/intake/sales-kit-library|src/intake/sales-kit-sample|src/intake/sales-kit-pii|src/intake/sales-kit-turns|src/intake/sales-kit-runtime|src/intake/sales-kit-learn|src/intake/intake.service.spec' --no-coverage

  echo "== 2/5 ops-web build =="
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
    src/lib/crm/intake-sales-kit-apply.spec.ts \
    src/lib/crm/intake-sales-kit-thread.util.spec.ts

  echo "== 3/5 restart services =="
  sudo -n /usr/bin/systemctl restart ptt-crm-api 2>/dev/null || true
  sleep 3
  curl -sf http://127.0.0.1:3000/health -o /dev/null && echo " api OK" || echo "WARN  api health check failed"

  sudo -n /usr/bin/systemctl restart ptt-ops-web 2>/dev/null || true
  sleep 2
  curl -sf http://127.0.0.1:3200/login -o /dev/null && echo " ops-web OK" || echo "WARN  ops-web health check failed"

  echo "== Intake Sales Kit S4 deploy complete =="
  echo "UAT: https://rs.pttads.vn/crm/intake/sales-kit?folder=dich-vu-seo-tong-the/qa"
  echo "Learn: https://rs.pttads.vn/crm/intake/sales-kit/learn"
  echo "Intake: https://rs.pttads.vn/crm/intake?lead_id=5"
  echo "LLM mode default off (runtime table). GDKD switches on /crm/intake/sales-kit."
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_intake_sales_kit_s4_vps.sh --local"
else
  echo "Dry-run. Set APPLY=1 to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Or on VPS: bash scripts/deploy_intake_sales_kit_s4_vps.sh --local"
fi
