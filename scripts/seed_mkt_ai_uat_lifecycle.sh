#!/usr/bin/env bash
# Seed MKT-AI UAT lifecycle + official marketing_plan + brief (psql — no psycopg2).
#
# Usage:
#   export DATABASE_URL=postgresql://...
#   ./scripts/seed_mkt_ai_uat_lifecycle.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL required}"

MKT_AI_SEED_TAG='mkt-ai-smoke-seed'
MKT_AI_SEED_SLUG='meta-lead-gen'
MKT_AI_SEED_STAGE='onboard'
MKT_AI_UAT_LEAD_ID='900000901'

echo "== Seed MKT-AI UAT lifecycle (slug=${MKT_AI_SEED_SLUG}, stage=${MKT_AI_SEED_STAGE}) =="

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
INSERT INTO crm_leads (sqlite_lead_id, full_name, phone, email, status, source)
VALUES (${MKT_AI_UAT_LEAD_ID}, 'MKT-AI UAT Lead', '', 'mkt-ai-uat@pttads.vn', 'qualified', 'uat')
ON CONFLICT (sqlite_lead_id) DO NOTHING;

DO \$\$
DECLARE
  v_lifecycle_id bigint;
  v_plan_id bigint;
  v_lead_id bigint;
  v_target bigint;
  v_brief jsonb := '{
    "brand_name": "ABC Logistics",
    "industry": "Logistics B2B",
    "service_slug": "${MKT_AI_SEED_SLUG}",
    "objective": "lead",
    "budget_monthly_vnd": 80000000,
    "geo_markets": ["HCM", "HN"],
    "challenges": "CPL cao, thiếu ICP rõ ràng",
    "competitors": ["Competitor A"],
    "usp": "Giảm CPL 25% trong 90 ngày"
  }'::jsonb;
BEGIN
  SELECT id INTO v_lifecycle_id
  FROM crm_service_lifecycle
  WHERE service_slug = '${MKT_AI_SEED_SLUG}' AND notes = '${MKT_AI_SEED_TAG}'
  ORDER BY id DESC
  LIMIT 1;

  IF v_lifecycle_id IS NULL THEN
    INSERT INTO crm_service_lifecycle (service_slug, stage, status, notes, lead_id)
    VALUES ('${MKT_AI_SEED_SLUG}', '${MKT_AI_SEED_STAGE}', 'active', '${MKT_AI_SEED_TAG}', ${MKT_AI_UAT_LEAD_ID})
    RETURNING id INTO v_lifecycle_id;
    RAISE NOTICE 'INSERT lifecycle_id=%', v_lifecycle_id;
  ELSE
    UPDATE crm_service_lifecycle
    SET lead_id = COALESCE(lead_id, ${MKT_AI_UAT_LEAD_ID})
    WHERE id = v_lifecycle_id;
    RAISE NOTICE 'REUSE lifecycle_id=%', v_lifecycle_id;
  END IF;

  SELECT COALESCE(
    (SELECT lead_id FROM crm_service_lifecycle WHERE id = v_lifecycle_id),
    (SELECT sqlite_lead_id FROM crm_leads ORDER BY sqlite_lead_id LIMIT 1),
    ${MKT_AI_UAT_LEAD_ID}::bigint
  ) INTO v_lead_id;

  FOR v_target IN SELECT unnest(ARRAY[v_lifecycle_id, 1::bigint]) LOOP
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM crm_service_lifecycle WHERE id = v_target);

    UPDATE crm_service_lifecycle
    SET lead_id = COALESCE(lead_id, v_lead_id),
        service_slug = COALESCE(NULLIF(trim(service_slug), ''), '${MKT_AI_SEED_SLUG}')
    WHERE id = v_target;

    SELECT marketing_plan_id INTO v_plan_id FROM crm_service_lifecycle WHERE id = v_target;
    IF v_plan_id IS NOT NULL THEN
      RAISE NOTICE 'REUSE lifecycle % marketing_plan_id=%', v_target, v_plan_id;
      CONTINUE;
    END IF;

    INSERT INTO crm_marketing_plans (
      code, name, status, plan_kind, lead_id, lifecycle_id,
      north_star, objectives, notes,
      strategy_framework_json, target_market_prof_json, target_market_steps4_json
    )
    VALUES (
      format('LC-%s-OFFICIAL', v_target),
      format('Lifecycle #%s TMMT (chính thức)', v_target),
      'draft',
      'official',
      COALESCE((SELECT lead_id FROM crm_service_lifecycle WHERE id = v_target), v_lead_id),
      v_target,
      'Lead gen logistics B2B',
      'Tăng lead chất lượng Meta + Google',
      'UAT seed official plan',
      '{"target_market":"SMB logistics VN"}'::jsonb,
      '{"market_context":"Seed context","segmentation_icp":"Seed ICP placeholder for UAT apply path"}'::jsonb,
      '{}'::jsonb
    )
    RETURNING id INTO v_plan_id;

    UPDATE crm_service_lifecycle SET marketing_plan_id = v_plan_id WHERE id = v_target;
    RAISE NOTICE 'INSERT lifecycle % marketing_plan_id=%', v_target, v_plan_id;
  END LOOP;

  INSERT INTO mkt_ai_briefs (lifecycle_id, brief_json, prefill_sources_json, created_by, updated_by)
  VALUES (v_lifecycle_id, v_brief, '[]'::jsonb, 'uat-seed', 'uat-seed')
  ON CONFLICT (lifecycle_id) DO UPDATE
    SET brief_json = EXCLUDED.brief_json,
        updated_by = 'uat-seed',
        updated_at = NOW();

  RAISE NOTICE 'UPSERT mkt_ai_briefs lifecycle_id=%', v_lifecycle_id;
END \$\$;
SQL

SEED_ID="$(psql "$DATABASE_URL" -tAc \
  "SELECT id FROM crm_service_lifecycle WHERE notes='${MKT_AI_SEED_TAG}' ORDER BY id DESC LIMIT 1" \
  | tr -d '[:space:]')"

PLAN1="$(psql "$DATABASE_URL" -tAc \
  "SELECT COALESCE(marketing_plan_id::text, 'null') FROM crm_service_lifecycle WHERE id=1" \
  | tr -d '[:space:]')"

echo "OK  LIFECYCLE_ID=${SEED_ID:-?} (tag=${MKT_AI_SEED_TAG})"
echo "OK  lifecycle #1 marketing_plan_id=${PLAN1}"
echo "Tip: export LIFECYCLE_ID=${SEED_ID:-1} for UAT"
