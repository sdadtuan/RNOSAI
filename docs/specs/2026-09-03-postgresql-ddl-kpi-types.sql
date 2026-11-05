-- KPI Types — Wave 1 DDL + seed (2026-09-03)
-- Idempotent: safe to re-run
-- Depends on: crm_kpi_groups, crm_departments, crm_positions, crm_kpi_metrics

CREATE TABLE IF NOT EXISTS crm_kpi_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'PTT',
  code varchar(40) NOT NULL,
  name varchar(80) NOT NULL,
  value_types text[] NOT NULL,
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS crm_kpi_data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'PTT',
  code varchar(60) NOT NULL,
  name varchar(120) NOT NULL,
  adapter_key text NOT NULL,
  entities text[] NOT NULL,
  health text NOT NULL DEFAULT 'UNKNOWN'
    CHECK (health IN ('UNKNOWN','HEALTHY','STALE','CONNECTION_ERROR','UNAVAILABLE')),
  last_checked_at timestamptz,
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS crm_kpi_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'PTT',
  kpi_group_id uuid NOT NULL REFERENCES crm_kpi_groups(id),
  code varchar(80) NOT NULL,
  name varchar(150) NOT NULL,
  short_name varchar(50),
  description varchar(1000),
  direction text NOT NULL CHECK (direction IN ('INCREASE','DECREASE','RANGE')),
  value_type text NOT NULL CHECK (value_type IN (
    'INTEGER','DECIMAL','PERCENTAGE','CURRENCY','DURATION','SCORE','BOOLEAN')),
  unit_id uuid NOT NULL REFERENCES crm_kpi_units(id),
  decimal_places smallint NOT NULL DEFAULT 0 CHECK (decimal_places BETWEEN 0 AND 4),
  target_mode text NOT NULL CHECK (target_mode IN ('SINGLE_TARGET','THRESHOLD','RANGE')),
  minimum_target numeric(20,4),
  default_target numeric(20,4) NOT NULL,
  stretch_target numeric(20,4),
  lower_limit numeric(20,4),
  upper_limit numeric(20,4),
  calculation_mode text NOT NULL CHECK (calculation_mode IN ('AUTO','MANUAL','HYBRID')),
  primary_data_source_id uuid REFERENCES crm_kpi_data_sources(id),
  data_entity varchar(100),
  aggregation_type text CHECK (aggregation_type IN (
    'COUNT','SUM','AVG','RATE','DISTINCT_COUNT','CUSTOM')),
  formula_expression text,
  formula_display text,
  sync_frequency text CHECK (sync_frequency IN (
    'REALTIME','HOURLY','DAILY','WEEKLY','MONTHLY')),
  timezone varchar(50) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  divide_by_zero_fallback text NOT NULL DEFAULT 'ERROR'
    CHECK (divide_by_zero_fallback IN ('ZERO','NA','ERROR')),
  manual_evidence_required boolean NOT NULL DEFAULT true,
  scope_type text NOT NULL CHECK (scope_type IN (
    'ORGANIZATION','DEPARTMENT','POSITION','CUSTOM')),
  weight_min numeric(5,2),
  weight_max numeric(5,2),
  display_order integer NOT NULL DEFAULT 1 CHECK (display_order > 0),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','INACTIVE')),
  is_system_default boolean NOT NULL DEFAULT false,
  current_version integer NOT NULL DEFAULT 1,
  created_by_staff_id bigint NOT NULL,
  updated_by_staff_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by_staff_id bigint,
  row_version integer NOT NULL DEFAULT 1,
  CHECK (weight_min IS NULL OR (weight_min >= 0 AND weight_min <= 100)),
  CHECK (weight_max IS NULL OR (weight_max >= 0 AND weight_max <= 100)),
  CHECK (weight_max IS NULL OR weight_min IS NULL OR weight_max >= weight_min)
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_kpi_types_tenant_code_uq
  ON crm_kpi_types (tenant_id, code) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS crm_kpi_types_tenant_name_ci_uq
  ON crm_kpi_types (tenant_id, lower(name)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS crm_kpi_types_tenant_group_status_idx
  ON crm_kpi_types (tenant_id, kpi_group_id, status, display_order);
CREATE INDEX IF NOT EXISTS crm_kpi_types_tenant_calc_status_idx
  ON crm_kpi_types (tenant_id, calculation_mode, status);

CREATE TABLE IF NOT EXISTS crm_kpi_type_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  kpi_type_id uuid NOT NULL REFERENCES crm_kpi_types(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  formula_expression text,
  formula_display text,
  data_source_snapshot jsonb,
  target_config_snapshot jsonb,
  change_reason varchar(500),
  validation_status text NOT NULL DEFAULT 'NOT_TESTED'
    CHECK (validation_status IN ('NOT_TESTED','VALID','INVALID','CONNECTION_ERROR')),
  validation_result jsonb,
  created_by_staff_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kpi_type_id, version_number)
);

CREATE TABLE IF NOT EXISTS crm_kpi_type_departments (
  type_id uuid NOT NULL REFERENCES crm_kpi_types(id) ON DELETE CASCADE,
  department_id bigint NOT NULL REFERENCES crm_departments(id) ON DELETE CASCADE,
  PRIMARY KEY (type_id, department_id)
);
CREATE TABLE IF NOT EXISTS crm_kpi_type_positions (
  type_id uuid NOT NULL REFERENCES crm_kpi_types(id) ON DELETE CASCADE,
  position_id bigint NOT NULL REFERENCES crm_positions(id) ON DELETE CASCADE,
  PRIMARY KEY (type_id, position_id)
);

CREATE TABLE IF NOT EXISTS crm_kpi_type_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  before_json jsonb,
  after_json jsonb,
  performed_by_staff_id bigint NOT NULL,
  performed_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet NULL,
  request_id text NULL
);

CREATE INDEX IF NOT EXISTS crm_kpi_type_audit_entity_idx
  ON crm_kpi_type_audit_logs (entity_id, performed_at DESC);

ALTER TABLE crm_kpi_metrics
  ADD COLUMN IF NOT EXISTS kpi_type_id uuid NULL REFERENCES crm_kpi_types(id);

CREATE INDEX IF NOT EXISTS idx_crm_kpi_metrics_kpi_type_id
  ON crm_kpi_metrics (kpi_type_id) WHERE kpi_type_id IS NOT NULL;

-- Seed units
INSERT INTO crm_kpi_units (tenant_id, code, name, value_types)
VALUES
  ('PTT', 'LEAD', 'Lead', ARRAY['INTEGER','DECIMAL']),
  ('PTT', 'PERCENT', '%', ARRAY['PERCENTAGE','DECIMAL']),
  ('PTT', 'VND', 'VNĐ', ARRAY['CURRENCY','DECIMAL']),
  ('PTT', 'VND_PER_LEAD', 'VNĐ/Lead', ARRAY['CURRENCY','DECIMAL']),
  ('PTT', 'TIMES', 'Lần', ARRAY['DECIMAL','INTEGER']),
  ('PTT', 'SESSION', 'Phiên', ARRAY['INTEGER','DECIMAL']),
  ('PTT', 'KEYWORD', 'Từ khóa', ARRAY['INTEGER']),
  ('PTT', 'POINT', 'Điểm', ARRAY['SCORE','DECIMAL','INTEGER']),
  ('PTT', 'APPOINTMENT', 'Lịch hẹn', ARRAY['INTEGER'])
ON CONFLICT (tenant_id, code) DO NOTHING;

-- Seed data sources
INSERT INTO crm_kpi_data_sources (tenant_id, code, name, adapter_key, entities, health)
VALUES
  ('PTT', 'CRM_LEAD_DASHBOARD', 'CRM Lead Dashboard', 'crm_lead', ARRAY['Lead'], 'UNKNOWN'),
  ('PTT', 'ADS_META', 'Ads Meta (daily_performance)', 'ads_meta', ARRAY['AdSpend','Lead'], 'UNKNOWN'),
  ('PTT', 'CRM_FINANCE', 'CRM Finance (conversion_value)', 'crm_finance', ARRAY['AttributedRevenue'], 'UNKNOWN'),
  ('PTT', 'WEBSITE_SEO', 'Website / SEO', 'unavailable', ARRAY['Session','Keyword'], 'UNAVAILABLE'),
  ('PTT', 'SOCIAL', 'Social', 'unavailable', ARRAY['Engagement'], 'UNAVAILABLE')
ON CONFLICT (tenant_id, code) DO NOTHING;

-- Seed sample types if parent groups exist
DO $$
DECLARE
  v_staff_id bigint;
  v_growth uuid;
  v_budget uuid;
  v_lead uuid;
  v_cpl_unit uuid;
  v_crm uuid;
  v_ads uuid;
BEGIN
  SELECT id INTO v_staff_id FROM crm_staff WHERE active = TRUE ORDER BY id LIMIT 1;
  IF v_staff_id IS NULL THEN
    v_staff_id := 1;
  END IF;

  SELECT id INTO v_growth FROM crm_kpi_groups
    WHERE tenant_id = 'PTT' AND code = 'GROWTH_CONVERSION' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_budget FROM crm_kpi_groups
    WHERE tenant_id = 'PTT' AND code = 'BUDGET_EFFICIENCY' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_lead FROM crm_kpi_units WHERE tenant_id = 'PTT' AND code = 'LEAD' LIMIT 1;
  SELECT id INTO v_cpl_unit FROM crm_kpi_units WHERE tenant_id = 'PTT' AND code = 'VND_PER_LEAD' LIMIT 1;
  SELECT id INTO v_crm FROM crm_kpi_data_sources WHERE tenant_id = 'PTT' AND code = 'CRM_LEAD_DASHBOARD' LIMIT 1;
  SELECT id INTO v_ads FROM crm_kpi_data_sources WHERE tenant_id = 'PTT' AND code = 'ADS_META' LIMIT 1;

  IF v_growth IS NOT NULL AND v_lead IS NOT NULL AND v_crm IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM crm_kpi_types WHERE tenant_id = 'PTT' AND code = 'MQL_COUNT' AND deleted_at IS NULL
     ) THEN
    INSERT INTO crm_kpi_types (
      tenant_id, kpi_group_id, code, name, short_name, description,
      direction, value_type, unit_id, decimal_places, target_mode,
      minimum_target, default_target, stretch_target,
      calculation_mode, primary_data_source_id, data_entity, aggregation_type,
      formula_expression, formula_display, sync_frequency,
      manual_evidence_required, scope_type, weight_min, weight_max,
      display_order, status, is_system_default,
      created_by_staff_id, updated_by_staff_id
    ) VALUES (
      'PTT', v_growth, 'MQL_COUNT', 'Marketing Qualified Leads (MQL)', 'MQL',
      'Số lượng khách hàng tiềm năng đạt tiêu chuẩn Marketing trong kỳ đánh giá.',
      'INCREASE', 'INTEGER', v_lead, 0, 'THRESHOLD',
      900, 1200, 1500,
      'AUTO', v_crm, 'Lead', 'COUNT',
      'COUNT(Lead WHERE lifecycle_stage = ''MQL'' AND created_at IN evaluation_period)',
      'Đếm Lead có trạng thái vòng đời là MQL trong kỳ đánh giá',
      'DAILY', FALSE, 'ORGANIZATION', 15, 35,
      1, 'DRAFT', TRUE,
      v_staff_id, v_staff_id
    );
    INSERT INTO crm_kpi_type_versions (
      tenant_id, kpi_type_id, version_number, formula_expression, formula_display,
      created_by_staff_id
    )
    SELECT 'PTT', id, 1, formula_expression, formula_display, v_staff_id
    FROM crm_kpi_types WHERE tenant_id = 'PTT' AND code = 'MQL_COUNT' AND deleted_at IS NULL;
  END IF;

  IF v_budget IS NOT NULL AND v_cpl_unit IS NOT NULL AND v_ads IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM crm_kpi_types WHERE tenant_id = 'PTT' AND code = 'CPL' AND deleted_at IS NULL
     ) THEN
    INSERT INTO crm_kpi_types (
      tenant_id, kpi_group_id, code, name, short_name, description,
      direction, value_type, unit_id, decimal_places, target_mode,
      default_target,
      calculation_mode, primary_data_source_id, data_entity, aggregation_type,
      formula_expression, formula_display, sync_frequency,
      divide_by_zero_fallback, manual_evidence_required, scope_type,
      display_order, status, is_system_default,
      created_by_staff_id, updated_by_staff_id
    ) VALUES (
      'PTT', v_budget, 'CPL', 'Cost per Lead', 'CPL',
      'Chi phí quảng cáo trên mỗi lead trong kỳ đánh giá.',
      'DECREASE', 'CURRENCY', v_cpl_unit, 0, 'SINGLE_TARGET',
      200000,
      'AUTO', v_ads, 'AdSpend', 'RATE',
      'RATE(SUM(AdSpend.amount WHERE date IN evaluation_period) / COUNT(Lead WHERE source_category = ''Paid'' AND created_at IN evaluation_period))',
      'Tổng spend Ads chia số Lead nguồn Paid trong kỳ',
      'DAILY', 'ERROR', FALSE, 'ORGANIZATION',
      2, 'DRAFT', TRUE,
      v_staff_id, v_staff_id
    );
    INSERT INTO crm_kpi_type_versions (
      tenant_id, kpi_type_id, version_number, formula_expression, formula_display,
      created_by_staff_id
    )
    SELECT 'PTT', id, 1, formula_expression, formula_display, v_staff_id
    FROM crm_kpi_types WHERE tenant_id = 'PTT' AND code = 'CPL' AND deleted_at IS NULL;
  END IF;
END $$;
