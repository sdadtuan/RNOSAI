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

echo "== Seed MKT-AI UAT lifecycle (slug=${MKT_AI_SEED_SLUG}, stage=${MKT_AI_SEED_STAGE}) =="

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
DO \$\$
DECLARE
  v_lifecycle_id bigint;
  v_plan_id bigint;
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
  SELECT id, marketing_plan_id INTO v_lifecycle_id, v_plan_id
  FROM crm_service_lifecycle
  WHERE service_slug = '${MKT_AI_SEED_SLUG}' AND notes = '${MKT_AI_SEED_TAG}'
  ORDER BY id DESC
  LIMIT 1;

  IF v_lifecycle_id IS NULL THEN
    INSERT INTO crm_service_lifecycle (service_slug, stage, status, notes)
    VALUES ('${MKT_AI_SEED_SLUG}', '${MKT_AI_SEED_STAGE}', 'active', '${MKT_AI_SEED_TAG}')
    RETURNING id INTO v_lifecycle_id;
    RAISE NOTICE 'INSERT lifecycle_id=%', v_lifecycle_id;
  ELSE
    RAISE NOTICE 'REUSE lifecycle_id=%', v_lifecycle_id;
  END IF;

  IF v_plan_id IS NULL THEN
    INSERT INTO crm_marketing_plans (
      code, name, status, plan_kind, lifecycle_id,
      north_star, objectives, notes,
      strategy_framework_json, target_market_prof_json, target_market_steps4_json
    )
    VALUES (
      format('LC-%s-OFFICIAL', v_lifecycle_id),
      'ABC Logistics TMMT (chính thức)',
      'draft',
      'official',
      v_lifecycle_id,
      'Lead gen logistics B2B',
      'Tăng lead chất lượng Meta + Google',
      'UAT seed official plan',
      '{"target_market":"SMB logistics VN"}'::jsonb,
      '{"market_context":"Seed context","segmentation_icp":"Seed ICP placeholder"}'::jsonb,
      '{}'::jsonb
    )
    RETURNING id INTO v_plan_id;

    UPDATE crm_service_lifecycle
    SET marketing_plan_id = v_plan_id
    WHERE id = v_lifecycle_id;

    RAISE NOTICE 'INSERT official marketing_plan_id=%', v_plan_id;
  ELSE
    RAISE NOTICE 'REUSE marketing_plan_id=%', v_plan_id;
  END IF;

  INSERT INTO mkt_ai_briefs (lifecycle_id, brief_json, prefill_sources_json, created_by, updated_by)
  VALUES (v_lifecycle_id, v_brief, '[]'::jsonb, 'uat-seed', 'uat-seed')
  ON CONFLICT (lifecycle_id) DO UPDATE
    SET brief_json = EXCLUDED.brief_json,
        updated_by = 'uat-seed',
        updated_at = NOW();

  RAISE NOTICE 'UPSERT mkt_ai_briefs lifecycle_id=%', v_lifecycle_id;
END \$\$;

DO \$\$
DECLARE
  v_id bigint := 1;
  v_plan_id bigint;
BEGIN
  SELECT marketing_plan_id INTO v_plan_id
  FROM crm_service_lifecycle WHERE id = v_id;

  IF NOT FOUND OR v_plan_id IS NOT NULL THEN
    RETURN;
  END IF;

  INSERT INTO crm_marketing_plans (
    code, name, status, plan_kind, lifecycle_id,
    north_star, objectives, notes,
    strategy_framework_json, target_market_prof_json, target_market_steps4_json
  )
  VALUES (
    format('LC-%s-OFFICIAL', v_id),
    'Lifecycle #1 TMMT (chính thức)',
    'draft',
    'official',
    v_id,
    'UAT lifecycle #1',
    'Pilot apply TMMT',
    'Auto-seed for smoke/UAT lifecycle #1',
    '{"target_market":"Pilot"}'::jsonb,
    '{"market_context":"ctx","segmentation_icp":"ICP seed for lifecycle 1 apply UAT path"}'::jsonb,
    '{}'::jsonb
  )
  RETURNING id INTO v_plan_id;

  UPDATE crm_service_lifecycle SET marketing_plan_id = v_plan_id WHERE id = v_id;
  RAISE NOTICE 'PATCH lifecycle #1 marketing_plan_id=%', v_plan_id;
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
