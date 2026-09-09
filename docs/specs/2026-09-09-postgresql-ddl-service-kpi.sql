-- Service KPI — templates, instances, actuals, policy packs
-- Migration: 2026-09-09-service-kpi

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
BEGIN;

CREATE TABLE IF NOT EXISTS crm_service_kpi_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  dv_code TEXT NOT NULL,
  name TEXT NOT NULL,
  owner_team TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  active_version_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  row_version INT NOT NULL DEFAULT 1,
  CONSTRAINT crm_skpi_tpl_status_chk CHECK (
    status IN ('DRAFT','IN_REVIEW','ACTIVE','SUSPENDED','RETIRED')
  )
);
CREATE INDEX IF NOT EXISTS idx_skpi_tpl_tenant_dv
  ON crm_service_kpi_templates (tenant_id, dv_code) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS crm_service_kpi_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  template_id UUID NOT NULL REFERENCES crm_service_kpi_templates(id),
  version_no INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  snapshot_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (template_id, version_no)
);

CREATE TABLE IF NOT EXISTS crm_service_kpi_template_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  template_version_id UUID NOT NULL REFERENCES crm_service_kpi_template_versions(id),
  dictionary_id UUID NOT NULL REFERENCES crm_kpi_dictionary(id),
  classification TEXT NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  client_visible BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  target_min NUMERIC,
  target_max NUMERIC,
  target_unit TEXT,
  scenario TEXT NOT NULL DEFAULT 'base',
  assumption_template TEXT NOT NULL DEFAULT '',
  disclaimer_template TEXT NOT NULL DEFAULT '',
  owner_role TEXT NOT NULL DEFAULT '',
  cadence TEXT NOT NULL DEFAULT 'weekly'
);

CREATE TABLE IF NOT EXISTS crm_service_kpi_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  dv_code TEXT,
  dictionary_id UUID NOT NULL REFERENCES crm_kpi_dictionary(id),
  template_version_id UUID REFERENCES crm_service_kpi_template_versions(id),
  classification TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  client_visible BOOLEAN NOT NULL DEFAULT TRUE,
  owner_name TEXT,
  target_min NUMERIC,
  target_max NUMERIC,
  scenario TEXT NOT NULL DEFAULT 'base',
  assumption_text TEXT NOT NULL DEFAULT '',
  assumption_state TEXT NOT NULL DEFAULT 'pending',
  disclaimer_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  row_version INT NOT NULL DEFAULT 1,
  CONSTRAINT crm_skpi_inst_source_chk CHECK (
    source_type IN ('quote_option','quote_line_item','proposal_version','project','work_order','campaign')
  ),
  CONSTRAINT crm_skpi_inst_status_chk CHECK (
    status IN ('DRAFT','READY_FOR_REVIEW','APPROVED','TRACKING','AT_RISK','ACHIEVED','MISSED','WAIVED','SUPERSEDED','ARCHIVED')
  )
);
CREATE INDEX IF NOT EXISTS idx_skpi_inst_source
  ON crm_service_kpi_instances (tenant_id, source_type, source_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS crm_service_kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  instance_id UUID NOT NULL REFERENCES crm_service_kpi_instances(id),
  quote_version_id TEXT NOT NULL,
  ledger TEXT NOT NULL DEFAULT 'quoted',
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT crm_skpi_snap_ledger_chk CHECK (ledger IN ('quoted','delivered','reported'))
);

CREATE TABLE IF NOT EXISTS crm_service_kpi_measurement_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  instance_id UUID NOT NULL UNIQUE REFERENCES crm_service_kpi_instances(id),
  owner_name TEXT NOT NULL,
  cadence TEXT NOT NULL DEFAULT 'daily',
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  data_source TEXT NOT NULL DEFAULT '',
  field_mapping TEXT NOT NULL DEFAULT '',
  freshness_sla_hours INT NOT NULL DEFAULT 24,
  qa_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS crm_service_kpi_actuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  instance_id UUID NOT NULL REFERENCES crm_service_kpi_instances(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  value NUMERIC,
  unit TEXT,
  quality_status TEXT NOT NULL DEFAULT 'pending_validation',
  collection_method TEXT NOT NULL DEFAULT 'manual',
  source_ref TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  superseded_by UUID,
  CONSTRAINT crm_skpi_act_quality_chk CHECK (
    quality_status IN ('valid','estimated','pending_validation','invalid','na')
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_skpi_actual_unique_open
  ON crm_service_kpi_actuals (instance_id, period_start, period_end, source_ref)
  WHERE superseded_by IS NULL;

CREATE TABLE IF NOT EXISTS crm_service_kpi_policy_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  industry TEXT NOT NULL,
  regulated BOOLEAN NOT NULL DEFAULT FALSE,
  rules_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  banned_phrases TEXT[] NOT NULL DEFAULT '{}',
  UNIQUE (tenant_id, industry)
);

INSERT INTO crm_service_kpi_policy_packs (industry, regulated, rules_json, banned_phrases) VALUES
(
  'real_estate',
  TRUE,
  '[{"forbid_classification":"COMMITTED_DELIVERABLE","kpi_kind":"booking_or_gmv"},{"require":["attribution","client_sales_sla","disclaimer"],"classification":"BUSINESS_OUTCOME"}]'::jsonb,
  ARRAY['cam kết doanh số','đảm bảo lead','chắc chắn X lead']
)
ON CONFLICT (tenant_id, industry) DO NOTHING;

CREATE TABLE IF NOT EXISTS crm_service_kpi_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  dv_code TEXT NOT NULL,
  dictionary_id TEXT NOT NULL,
  industry TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL DEFAULT '',
  budget_band TEXT NOT NULL DEFAULT '',
  p50 NUMERIC,
  p80 NUMERIC,
  sample_n INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, dv_code, dictionary_id, industry, channel, budget_band)
);

INSERT INTO schema_migrations (version, description)
VALUES ('2026-09-09-service-kpi', 'service kpi templates/instances/actuals/policy packs')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version, description)
VALUES ('2026-09-09-service-kpi-benchmarks', 'service kpi internal benchmark bands')
ON CONFLICT (version) DO NOTHING;

COMMIT;
