#!/usr/bin/env bash
# Seed ≥1 linked Service Delivery + Delivery Project + KPI campaign for Ops AI CrmContextPack.
# Idempotent via notes/code tags. Targets marketing plan #8 (360 AUTO DETAILING) by default.
#
# Usage:
#   export DATABASE_URL=postgresql://...
#   ./scripts/seed_ops_ai_context_pack.sh
#
# Env:
#   OPS_AI_SEED_PLAN_ID   default 8
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL required}"

PLAN_ID="${OPS_AI_SEED_PLAN_ID:-8}"
TAG='ops-ai-context-seed-360'
CLIENT_CODE='360-AUTO'
PROJECT_CODE='DP-360-AUTO-01'

echo "== Seed Ops AI CrmContextPack for plan_id=${PLAN_ID} =="

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
DO \$\$
DECLARE
  v_plan_id bigint := ${PLAN_ID};
  v_tag text := '${TAG}';
  v_client_id uuid;
  v_customer_id bigint;
  v_contract_id bigint;
  v_lifecycle_id bigint;
  v_project_id uuid;
  v_camp1 int;
  v_camp2 int;
  v_lead_id bigint;
  v_plan_name text;
BEGIN
  SELECT id, name, lead_id INTO v_plan_id, v_plan_name, v_lead_id
  FROM crm_marketing_plans WHERE id = v_plan_id;
  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'marketing plan % not found', ${PLAN_ID};
  END IF;

  -- Client
  SELECT id INTO v_client_id FROM clients WHERE code = '${CLIENT_CODE}' LIMIT 1;
  IF v_client_id IS NULL THEN
    INSERT INTO clients (code, name, industry_slug, status, notes)
    VALUES ('${CLIENT_CODE}', COALESCE(NULLIF(v_plan_name, ''), '360 AUTO DETAILING'),
            'auto-detailing', 'active', v_tag)
    RETURNING id INTO v_client_id;
    RAISE NOTICE 'INSERT client %', v_client_id;
  ELSE
    UPDATE clients SET name = COALESCE(NULLIF(v_plan_name, ''), name),
                       status = 'active', notes = v_tag, updated_at = now()
    WHERE id = v_client_id;
    RAISE NOTICE 'REUSE client %', v_client_id;
  END IF;

  -- Customer (contracts require customer_id)
  SELECT id INTO v_customer_id FROM crm_customers WHERE company = v_tag LIMIT 1;
  IF v_customer_id IS NULL THEN
    INSERT INTO crm_customers (name, company, email, lead_source)
    VALUES (COALESCE(NULLIF(v_plan_name, ''), '360 AUTO DETAILING'), v_tag,
            'ops-ai-360@pttads.vn', 'ops-ai-seed')
    RETURNING id INTO v_customer_id;
  END IF;

  -- Contract linking agency client
  SELECT id INTO v_contract_id
  FROM crm_contracts
  WHERE reference_code = 'CT-360-OPS-AI' OR notes = v_tag
  ORDER BY id DESC LIMIT 1;
  IF v_contract_id IS NULL THEN
    INSERT INTO crm_contracts (
      customer_id, reference_code, title, status, amount_vnd,
      service_slug, agency_client_id, lead_id, notes, billing_type
    ) VALUES (
      v_customer_id, 'CT-360-OPS-AI',
      'HD 360 AUTO DETAILING — Meta Lead Gen',
      'active', 45000000,
      'quang-cao-facebook', v_client_id::text, v_lead_id, v_tag, 'retainer'
    )
    RETURNING id INTO v_contract_id;
    RAISE NOTICE 'INSERT contract %', v_contract_id;
  ELSE
    UPDATE crm_contracts
    SET agency_client_id = v_client_id::text,
        customer_id = v_customer_id,
        status = 'active',
        updated_at = now()
    WHERE id = v_contract_id;
    RAISE NOTICE 'REUSE contract %', v_contract_id;
  END IF;

  -- Service Delivery (lifecycle)
  SELECT id INTO v_lifecycle_id
  FROM crm_service_lifecycle
  WHERE notes = v_tag OR (marketing_plan_id = v_plan_id AND notes LIKE 'ops-ai-context-seed%')
  ORDER BY id DESC LIMIT 1;
  IF v_lifecycle_id IS NULL THEN
    INSERT INTO crm_service_lifecycle (
      lead_id, customer_id, contract_id, service_slug, stage, status,
      notes, marketing_plan_id, stage_entered_at
    ) VALUES (
      v_lead_id, v_customer_id, v_contract_id, 'quang-cao-facebook', 'deliver', 'active',
      v_tag, v_plan_id, now()
    )
    RETURNING id INTO v_lifecycle_id;
    RAISE NOTICE 'INSERT lifecycle %', v_lifecycle_id;
  ELSE
    UPDATE crm_service_lifecycle
    SET marketing_plan_id = v_plan_id,
        contract_id = v_contract_id,
        customer_id = v_customer_id,
        lead_id = COALESCE(lead_id, v_lead_id),
        service_slug = 'quang-cao-facebook',
        stage = 'deliver',
        status = 'active',
        notes = v_tag,
        updated_at = now()
    WHERE id = v_lifecycle_id;
    RAISE NOTICE 'REUSE lifecycle %', v_lifecycle_id;
  END IF;

  -- Open delivery task
  IF NOT EXISTS (
    SELECT 1 FROM crm_svc_tasks WHERE lifecycle_id = v_lifecycle_id AND title LIKE 'Ops AI seed%'
  ) THEN
    INSERT INTO crm_svc_tasks (lifecycle_id, stage, step_index, title, description)
    VALUES
      (v_lifecycle_id, 'deliver', 1, 'Ops AI seed — Setup Meta Ads account', 'Seed open task'),
      (v_lifecycle_id, 'deliver', 2, 'Ops AI seed — Launch CPL campaign', 'Seed open task');
  END IF;

  -- Wire plan ↔ lifecycle + KPI metrics
  UPDATE crm_marketing_plans
  SET lifecycle_id = v_lifecycle_id,
      status = CASE WHEN status = 'draft' THEN 'active' ELSE status END,
      period_label = COALESCE(NULLIF(period_label, ''), 'Q3 2026'),
      success_metrics_json = '[
        {"kpi":"CPL","quoted":180000,"actual":165000},
        {"kpi":"Leads","quoted":120,"actual":98}
      ]'::jsonb,
      updated_at = now()
  WHERE id = v_plan_id;

  IF NOT EXISTS (
    SELECT 1 FROM crm_marketing_plan_milestones WHERE plan_id = v_plan_id AND title LIKE 'Ops AI seed%'
  ) THEN
    INSERT INTO crm_marketing_plan_milestones (plan_id, position, title, due_date, status)
    VALUES
      (v_plan_id, 1, 'Ops AI seed — Kickoff & creative', '2026-09-30', 'done'),
      (v_plan_id, 2, 'Ops AI seed — Scale winning ads', '2026-10-31', 'in_progress');
  END IF;

  -- Delivery Project
  SELECT id INTO v_project_id
  FROM crm_delivery_projects
  WHERE code = '${PROJECT_CODE}' AND deleted_at IS NULL
  LIMIT 1;
  IF v_project_id IS NULL THEN
    INSERT INTO crm_delivery_projects (
      tenant_id, code, name, capabilities, status, lifecycle_id,
      project_type, priority, health_status, description, start_date, end_date
    ) VALUES (
      'PTT', '${PROJECT_CODE}', '360 AUTO — Delivery Meta Lead Gen',
      ARRAY['delivery']::text[], 'active', v_lifecycle_id,
      'meta_lead_gen', 'high', 'stable',
      v_tag, CURRENT_DATE, CURRENT_DATE + 90
    )
    RETURNING id INTO v_project_id;
    RAISE NOTICE 'INSERT project %', v_project_id;
  ELSE
    UPDATE crm_delivery_projects
    SET lifecycle_id = v_lifecycle_id,
        status = 'active',
        health_status = 'stable',
        name = '360 AUTO — Delivery Meta Lead Gen',
        description = v_tag,
        updated_at = now()
    WHERE id = v_project_id;
    RAISE NOTICE 'REUSE project %', v_project_id;
  END IF;

  -- KPI campaigns linked to plan
  SELECT id INTO v_camp1 FROM crm_campaigns WHERE code = 'CAMP-360-META-CPL' LIMIT 1;
  IF v_camp1 IS NULL THEN
    INSERT INTO crm_campaigns (code, name, status, channel)
    VALUES ('CAMP-360-META-CPL', '360 Meta CPL Q3', 'active', 'meta')
    RETURNING id INTO v_camp1;
  END IF;
  SELECT id INTO v_camp2 FROM crm_campaigns WHERE code = 'CAMP-360-GG-SEARCH' LIMIT 1;
  IF v_camp2 IS NULL THEN
    INSERT INTO crm_campaigns (code, name, status, channel)
    VALUES ('CAMP-360-GG-SEARCH', '360 Google Search Leads', 'active', 'google')
    RETURNING id INTO v_camp2;
  END IF;

  INSERT INTO crm_marketing_plan_campaigns (plan_id, campaign_id)
  VALUES (v_plan_id, v_camp1), (v_plan_id, v_camp2)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'SEED_OK plan=% lifecycle=% project=% client=% camps=%,%',
    v_plan_id, v_lifecycle_id, v_project_id, v_client_id, v_camp1, v_camp2;
END \$\$;

-- Machine-readable summary for Try tool defaults
SELECT
  p.id AS plan_id,
  sl.id AS lifecycle_id,
  dp.id::text AS project_id,
  c.id::text AS client_id,
  array_agg(DISTINCT camp.id ORDER BY camp.id) AS campaign_ids
FROM crm_marketing_plans p
JOIN crm_service_lifecycle sl ON sl.id = p.lifecycle_id
JOIN crm_delivery_projects dp ON dp.lifecycle_id = sl.id AND dp.deleted_at IS NULL
JOIN crm_contracts ct ON ct.id = sl.contract_id
JOIN clients c ON c.id::text = ct.agency_client_id
LEFT JOIN crm_marketing_plan_campaigns mpc ON mpc.plan_id = p.id
LEFT JOIN crm_campaigns camp ON camp.id = mpc.campaign_id
WHERE p.id = ${PLAN_ID}
GROUP BY p.id, sl.id, dp.id, c.id;
SQL

echo "== Done =="
