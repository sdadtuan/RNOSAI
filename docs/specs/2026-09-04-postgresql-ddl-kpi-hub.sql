-- KPI Hub DDL — idempotent (2026-09-04)
-- Schema: crm_kpi_hub_* tables for KPI Hub v1.1

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Workspace
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_kpi_hub_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  name TEXT NOT NULL,
  company TEXT,
  logo_url TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  locale TEXT NOT NULL DEFAULT 'vi',
  currency TEXT NOT NULL DEFAULT 'VND',
  week_start TEXT NOT NULL DEFAULT 'MONDAY',
  default_period_grain TEXT NOT NULL DEFAULT 'MONTH',
  close_day INT NOT NULL DEFAULT 3,
  reconcile_day INT NOT NULL DEFAULT 5,
  lock_closed_periods BOOLEAN NOT NULL DEFAULT TRUE,
  allow_reopen BOOLEAN NOT NULL DEFAULT FALSE,
  require_kpi_approval BOOLEAN NOT NULL DEFAULT TRUE,
  auto_quality BOOLEAN NOT NULL DEFAULT TRUE,
  alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  row_version INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_kpi_hub_ws_tenant ON crm_kpi_hub_workspaces (tenant_id) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Dictionary
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_kpi_dictionary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  workspace_id UUID NOT NULL REFERENCES crm_kpi_hub_workspaces(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  kpi_group TEXT,
  kpi_group_color TEXT DEFAULT '#64748B',
  kpi_type_id UUID,
  direction TEXT NOT NULL DEFAULT 'HIGHER_IS_BETTER',
  unit TEXT,
  decimal_places INT NOT NULL DEFAULT 0,
  calc_kind TEXT NOT NULL DEFAULT 'COUNT',
  formula_ast JSONB,
  formula_display TEXT,
  tech_preview TEXT,
  business_formula TEXT,
  blank_if_zero BOOLEAN NOT NULL DEFAULT FALSE,
  non_additive_ratio BOOLEAN NOT NULL DEFAULT FALSE,
  allow_manual BOOLEAN NOT NULL DEFAULT FALSE,
  numerator_code TEXT,
  denominator_code TEXT,
  primary_source TEXT,
  sync_frequency TEXT,
  kpi_owner_json JSONB,
  data_owner_json JSONB,
  time_basis_field TEXT,
  timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh',
  attribution TEXT DEFAULT 'LAST_TOUCH',
  refresh_cron TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  current_version INT NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_by_staff_id INT,
  updated_by_staff_id INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  row_version INT NOT NULL DEFAULT 1,
  CONSTRAINT crm_kpi_dictionary_status_chk CHECK (
    status IN ('DRAFT','PENDING_APPROVAL','ACTIVE','NEED_REVIEW','DEPRECATED','ARCHIVED')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_kpi_dictionary_ws_code
  ON crm_kpi_dictionary (workspace_id, code) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_kpi_dictionary_ws_status
  ON crm_kpi_dictionary (workspace_id, status, kpi_group) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Dictionary versions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_kpi_dictionary_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  workspace_id UUID NOT NULL,
  dictionary_id UUID NOT NULL REFERENCES crm_kpi_dictionary(id),
  version_no INT NOT NULL,
  snapshot JSONB NOT NULL,
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  change_reason TEXT,
  created_by_staff_id INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  row_version INT NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------------------
-- Formula parts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_kpi_formula_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  workspace_id UUID NOT NULL,
  dictionary_id UUID NOT NULL REFERENCES crm_kpi_dictionary(id),
  role TEXT NOT NULL,
  ref_dictionary_id UUID,
  agg TEXT,
  field_ref TEXT,
  filters JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  row_version INT NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------------------
-- Source connections
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_kpi_source_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  workspace_id UUID NOT NULL REFERENCES crm_kpi_hub_workspaces(id),
  system TEXT NOT NULL,
  name TEXT NOT NULL,
  external_ref TEXT,
  sla_minutes INT NOT NULL DEFAULT 60,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  status TEXT NOT NULL DEFAULT 'UNKNOWN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  row_version INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_kpi_source_conn_fresh
  ON crm_kpi_source_connections (workspace_id, last_success_at);

-- ---------------------------------------------------------------------------
-- Source bindings & mapping rules
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_kpi_source_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  workspace_id UUID NOT NULL,
  dictionary_id UUID NOT NULL REFERENCES crm_kpi_dictionary(id),
  connection_id UUID NOT NULL REFERENCES crm_kpi_source_connections(id),
  entity_name TEXT,
  role TEXT,
  join_keys JSONB,
  value_field TEXT,
  agg TEXT,
  filters JSONB DEFAULT '[]'::jsonb,
  refresh_override TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  row_version INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS crm_kpi_mapping_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  workspace_id UUID NOT NULL,
  dictionary_id UUID NOT NULL REFERENCES crm_kpi_dictionary(id),
  link_strategy TEXT,
  date_match TEXT,
  normalize_utm BOOLEAN DEFAULT FALSE,
  use_mapping_table BOOLEAN DEFAULT FALSE,
  mapping_table_binding_id UUID,
  field_pairs JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  row_version INT NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------------------
-- Period targets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_kpi_period_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  workspace_id UUID NOT NULL,
  dictionary_id UUID NOT NULL REFERENCES crm_kpi_dictionary(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  grain TEXT NOT NULL DEFAULT 'MONTH',
  scope_type TEXT NOT NULL DEFAULT 'ORGANIZATION',
  scope_json JSONB DEFAULT '{}'::jsonb,
  scope_hash TEXT NOT NULL DEFAULT 'org',
  target_value NUMERIC,
  warning_value NUMERIC,
  critical_value NUMERIC,
  unit_id UUID,
  direction TEXT,
  alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  row_version INT NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_kpi_period_target
  ON crm_kpi_period_targets (dictionary_id, period_start, grain, scope_hash) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Alerts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_kpi_alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  workspace_id UUID NOT NULL,
  dictionary_id UUID REFERENCES crm_kpi_dictionary(id),
  condition TEXT,
  frequency_minutes INT NOT NULL DEFAULT 240,
  recipient_ids JSONB DEFAULT '[]'::jsonb,
  channels JSONB DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  row_version INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS crm_kpi_alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  workspace_id UUID NOT NULL,
  rule_id UUID REFERENCES crm_kpi_alert_rules(id),
  dictionary_id UUID REFERENCES crm_kpi_dictionary(id),
  level TEXT NOT NULL,
  title TEXT NOT NULL,
  scope_json JSONB,
  actual NUMERIC,
  threshold NUMERIC,
  status TEXT NOT NULL DEFAULT 'OPEN',
  notified_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  row_version INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_kpi_alert_events_ws
  ON crm_kpi_alert_events (workspace_id, status, created_at DESC) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Facts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_kpi_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  workspace_id UUID NOT NULL,
  dictionary_id UUID NOT NULL REFERENCES crm_kpi_dictionary(id),
  version_id UUID,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  grain TEXT NOT NULL DEFAULT 'MONTH',
  scope_hash TEXT NOT NULL DEFAULT 'org',
  dimensions_json JSONB DEFAULT '{}'::jsonb,
  actual_value NUMERIC,
  num_value NUMERIC,
  den_value NUMERIC,
  calculation_status TEXT NOT NULL DEFAULT 'SUCCESS',
  data_freshness_at TIMESTAMPTZ,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_lineage_ref TEXT,
  is_blank BOOLEAN NOT NULL DEFAULT FALSE,
  is_override BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  row_version INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_kpi_facts_dict_period
  ON crm_kpi_facts (dictionary_id, period_start, scope_hash) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Data quality
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_kpi_quality_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  workspace_id UUID NOT NULL,
  name TEXT NOT NULL,
  connection_id UUID REFERENCES crm_kpi_source_connections(id),
  check_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'WARNING',
  expression TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  row_version INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS crm_kpi_quality_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  workspace_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  score NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  row_version INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS crm_kpi_quality_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  workspace_id UUID NOT NULL,
  rule_id UUID REFERENCES crm_kpi_quality_rules(id),
  run_id UUID REFERENCES crm_kpi_quality_runs(id),
  status TEXT NOT NULL DEFAULT 'OPEN',
  severity TEXT NOT NULL DEFAULT 'WARNING',
  title TEXT NOT NULL,
  description TEXT,
  assignee_id INT,
  sla_due TIMESTAMPTZ,
  sample_rows JSONB DEFAULT '[]'::jsonb,
  ticket_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  row_version INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_kpi_quality_issues_ws
  ON crm_kpi_quality_issues (workspace_id, status, created_at DESC) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_kpi_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  workspace_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  scope TEXT,
  definition JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  owner_staff_id INT,
  last_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  row_version INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS crm_kpi_report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  workspace_id UUID NOT NULL,
  report_id UUID NOT NULL REFERENCES crm_kpi_reports(id),
  cron TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'EMAIL',
  recipients JSONB DEFAULT '[]'::jsonb,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  row_version INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS crm_kpi_report_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  workspace_id UUID NOT NULL,
  report_id UUID NOT NULL REFERENCES crm_kpi_reports(id),
  user_id INT,
  team_id INT,
  action TEXT NOT NULL DEFAULT 'SHARED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  row_version INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_kpi_reports_ws
  ON crm_kpi_reports (workspace_id, status, updated_at DESC) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_kpi_hub_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  workspace_id UUID NOT NULL,
  actor_staff_id INT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_label TEXT,
  snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  row_version INT NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------------------
-- Seed default workspace (idempotent)
-- ---------------------------------------------------------------------------
INSERT INTO crm_kpi_hub_workspaces (
  id, tenant_id, name, company, timezone, locale, currency, week_start,
  default_period_grain, close_day, reconcile_day, lock_closed_periods,
  allow_reopen, require_kpi_approval, auto_quality, alerts_enabled, maintenance_mode
) VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'PTT',
  'KPI Hub - Marketing & Sales',
  'PTT Digital',
  'Asia/Ho_Chi_Minh',
  'vi',
  'VND',
  'MONDAY',
  'MONTH',
  3,
  5,
  TRUE,
  FALSE,
  TRUE,
  TRUE,
  TRUE,
  FALSE
) ON CONFLICT (id) DO NOTHING;
