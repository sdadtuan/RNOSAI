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

P6_TOOLS_JSON='["presales.context.read","presales.autofill_tmmt","insight.draft_from_presales","insight.approve","tmmt.confirm_field","marketing_plan.read","marketing_plan.write_draft","marketing_plan.generate_review","service.recommend_from_signals","consult.draft_from_research","presales.return_to_am","proposal.draft_from_consult","service_delivery.read","service_delivery.propose_transition","delivery_project.read","kpi_campaign.read","task.create_draft","task.update_draft","plan.breakdown_to_roles","kpi_target.write_draft","kpi_target.read"]'

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
         COALESCE(allowed_tools, '[]'::jsonb) || '["presales.context.read","plan.breakdown_to_roles","task.create_draft","task.update_draft","insight.approve","tmmt.confirm_field"]'::jsonb
       ) AS t(x)
   )
 WHERE name ILIKE 'ops-%'
   AND allowed_tools ?| ARRAY['marketing_plan.read','plan.breakdown_to_roles','task.create_draft'];

-- SUPER-ADMIN + MKT-01 research approve (Lead duyệt Insight)
INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, g.section_id, g.action
FROM crm_positions p
CROSS JOIN (VALUES
  ('crm_research', 'view'),
  ('crm_research', 'create'),
  ('crm_research', 'edit'),
  ('crm_research', 'run'),
  ('crm_research', 'approve'),
  ('crm_research', 'export'),
  ('crm_research', 'configure')
) AS g(section_id, action)
WHERE lower(trim(p.code)) = 'super-admin'
ON CONFLICT (position_id, section_id, action) DO NOTHING;

INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, g.section_id, g.action
FROM crm_positions p
CROSS JOIN (VALUES
  ('crm_research', 'view'),
  ('crm_research', 'create'),
  ('crm_research', 'edit'),
  ('crm_research', 'run'),
  ('crm_research', 'export'),
  ('crm_research', 'approve')
) AS g(section_id, action)
WHERE lower(trim(p.code)) IN ('mkt-01', 'mkl')
ON CONFLICT (position_id, section_id, action) DO NOTHING;

-- P8.3 — backfill fixture Insight #1 / research #2 / lifecycle #5 (360 AUTO DETAILING)
UPDATE crm_research_insights
   SET ai_generated = TRUE,
       confidence_json = COALESCE(confidence_json, '{}'::jsonb) || jsonb_build_object(
         'origin', 'presales_ai',
         'source_tool', 'insight.draft_from_presales',
         'ai_draft', jsonb_build_object('presales', true),
         'lifecycle_id', 5,
         'research_id', 2
       ),
       confidence_rationale = CASE
         WHEN status IN ('approved_internal', 'approved_client_facing', 'published')
           AND (confidence_rationale ILIKE '%pending%' OR confidence_rationale IS NULL OR trim(confidence_rationale) = '')
         THEN 'P8.3 approved_internal — đã duyệt (Winning)'
         ELSE COALESCE(
           NULLIF(trim(confidence_rationale), ''),
           'P7 insight.draft_from_presales — pending human review'
         )
       END,
       updated_at = NOW()
 WHERE id = 1
   AND project_id = 2;
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
    src/ai-intelligence/ai-tools/ops-tmmt-persist.util.spec.ts \
    src/ai-intelligence/ai-tools/ops-presales-context.service.spec.ts \
    src/ai-intelligence/ai-tools/ops-plan-breakdown.service.spec.ts \
    src/ai-intelligence/ai-tools/ops-draft-write.service.spec.ts \
    src/ai-intelligence/ai-tools/ops-insight-origin.util.spec.ts \
    src/ai-intelligence/ai-tools/ops-insight-approve.service.spec.ts \
    src/ai-intelligence/ai-tools/ops-insight-draft.service.spec.ts \
    src/ai-intelligence/ai-tools/tools/ops-context.tools.spec.ts \
    src/ai-intelligence/ai-tools/tool.registry.spec.ts \
    src/service-lifecycle/lifecycle-marketing-plan.util.spec.ts \
    src/market-research/insight-gate.util.spec.ts \
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

# Deploy from main (P6+P7 merged). Override with P6_GIT_REF if needed.
P6_REF="${P6_GIT_REF:-origin/main}"
ssh "$VPS_USER@$VPS_HOST" "cd '$VPS_ROOT' && git fetch origin && git checkout -B main '$P6_REF' && bash scripts/deploy_p6_presales_context_gates_vps.sh --local"
