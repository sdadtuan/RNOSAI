#!/usr/bin/env bash
# Deploy P6 — presales.context.read + WinningPlanGate + QT/HĐ–campaign map.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_p6_presales_context_gates_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_p6_presales_context_gates_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

P6_TOOLS_JSON='["presales.context.read","marketing_plan.read","marketing_plan.write_draft","service_delivery.read","service_delivery.propose_transition","delivery_project.read","kpi_campaign.read","task.create_draft","task.update_draft","plan.breakdown_to_roles","kpi_target.write_draft","kpi_target.read"]'

seed_allowlist() {
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "WARN  DATABASE_URL unset — skip allowlist seed"
    return 0
  fi
  echo "== seed admin AI policies + ops tool keys with presales.context.read =="
  psql "$DATABASE_URL" <<SQL
UPDATE admin_ai_agent_policies
   SET allowed_tools = (
     SELECT COALESCE(jsonb_agg(DISTINCT x ORDER BY x), '[]'::jsonb)
       FROM jsonb_array_elements_text(
         COALESCE(allowed_tools, '[]'::jsonb) || '${P6_TOOLS_JSON}'::jsonb
       ) AS t(x)
   ),
   updated_at = NOW()
 WHERE agent_code IN (
   'ptt-ops-strategist',
   'ptt-ops-pm',
   'grok-bot-—-strategist+pm-(p1)'
 );

UPDATE ai_tool_api_keys
   SET allowed_tools = (
     SELECT COALESCE(jsonb_agg(DISTINCT x ORDER BY x), '[]'::jsonb)
       FROM jsonb_array_elements_text(
         COALESCE(allowed_tools, '[]'::jsonb) || '["presales.context.read","plan.breakdown_to_roles","task.create_draft","task.update_draft"]'::jsonb
       ) AS t(x)
   )
 WHERE name ILIKE 'ops-%'
   AND allowed_tools ?| ARRAY['marketing_plan.read','plan.breakdown_to_roles','task.create_draft'];
SQL
}

run_local() {
  cd "$ROOT"
  echo "== P6 presales context/gates deploy @ $(git rev-parse --short HEAD) =="

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi
  if [[ -f "$ROOT/deploy/runtime.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/deploy/runtime.env"
    set +a
  fi

  echo "== ptt-crm-api build + P6 tests =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  npm run build
  npx jest --config jest.config.js \
    src/ai-intelligence/ai-tools/ops-winning-plan-gate.util.spec.ts \
    src/ai-intelligence/ai-tools/ops-presales-context.service.spec.ts \
    src/ai-intelligence/ai-tools/ops-plan-breakdown.service.spec.ts \
    src/ai-intelligence/ai-tools/ops-draft-write.service.spec.ts \
    src/ai-intelligence/ai-tools/tools/ops-context.tools.spec.ts \
    src/ai-intelligence/ai-tools/tool.registry.spec.ts \
    src/proposals/quote-list.service.spec.ts \
    --forceExit --no-coverage

  echo "== ops-web build =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  "$ROOT/scripts/deploy_ops_web.sh" build

  seed_allowlist

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

  echo "OK  P6 deployed"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
  exit 0
fi

if [[ "$APPLY" != "1" ]]; then
  echo "Dry run. Set APPLY=1 to deploy to $VPS_USER@$VPS_HOST:$VPS_ROOT"
  exit 0
fi

# Prefer feature branch until merged to main (P6 ship).
P6_REF="${P6_GIT_REF:-origin/feat/p6-presales-context-gates}"
ssh "$VPS_USER@$VPS_HOST" "cd '$VPS_ROOT' && git fetch origin && git checkout -B feat/p6-presales-context-gates '$P6_REF' && bash scripts/deploy_p6_presales_context_gates_vps.sh --local"
