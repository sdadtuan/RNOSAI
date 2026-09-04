-- KPI Hub P2 DDL — idempotent ALTER/CREATE (2026-09-04)
-- Run after 2026-09-04-postgresql-ddl-kpi-hub.sql

-- ---------------------------------------------------------------------------
-- Dictionary extensions
-- ---------------------------------------------------------------------------
ALTER TABLE crm_kpi_dictionary
  ADD COLUMN IF NOT EXISTS attribution_window_days INT,
  ADD COLUMN IF NOT EXISTS pending_version_id UUID,
  ADD COLUMN IF NOT EXISTS data_issue_precedence BOOLEAN NOT NULL DEFAULT TRUE;

-- ---------------------------------------------------------------------------
-- Formula parts extensions
-- ---------------------------------------------------------------------------
ALTER TABLE crm_kpi_formula_parts
  ADD COLUMN IF NOT EXISTS filters JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS filter_version INT NOT NULL DEFAULT 1;

-- ---------------------------------------------------------------------------
-- Period targets hierarchy
-- ---------------------------------------------------------------------------
ALTER TABLE crm_kpi_period_targets
  ADD COLUMN IF NOT EXISTS parent_scope_hash TEXT,
  ADD COLUMN IF NOT EXISTS hierarchy_level TEXT NOT NULL DEFAULT 'WORKSPACE';

-- ---------------------------------------------------------------------------
-- Alert rules extensions
-- ---------------------------------------------------------------------------
ALTER TABLE crm_kpi_alert_rules
  ADD COLUMN IF NOT EXISTS condition_json JSONB,
  ADD COLUMN IF NOT EXISTS quiet_hours_json JSONB,
  ADD COLUMN IF NOT EXISTS dedup_minutes INT NOT NULL DEFAULT 240;

-- ---------------------------------------------------------------------------
-- In-app notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_kpi_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  workspace_id UUID NOT NULL REFERENCES crm_kpi_hub_workspaces(id),
  staff_id INT NOT NULL,
  level TEXT NOT NULL DEFAULT 'INFO',
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  row_version INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_kpi_notifications_staff
  ON crm_kpi_notifications (workspace_id, staff_id, read_at, created_at DESC)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Report delivery log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_kpi_report_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  workspace_id UUID NOT NULL,
  report_id UUID NOT NULL REFERENCES crm_kpi_reports(id),
  schedule_id UUID REFERENCES crm_kpi_report_schedules(id),
  status TEXT NOT NULL DEFAULT 'PENDING',
  channel TEXT NOT NULL DEFAULT 'EMAIL',
  recipients_json JSONB DEFAULT '[]'::jsonb,
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  row_version INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_kpi_report_deliveries_report
  ON crm_kpi_report_deliveries (report_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Audit log (P1 may already exist — IF NOT EXISTS is safe)
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
-- Indexes §19.14 (supplement P1)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_kpi_dictionary_ws_status_group
  ON crm_kpi_dictionary (workspace_id, status, kpi_group)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_kpi_facts_upsert
  ON crm_kpi_facts (
    dictionary_id,
    COALESCE(version_id, '00000000-0000-0000-0000-000000000000'::uuid),
    period_start,
    grain,
    scope_hash
  )
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_kpi_period_targets_dict_period
  ON crm_kpi_period_targets (dictionary_id, period_start, scope_hash)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_kpi_source_conn_id_fresh
  ON crm_kpi_source_connections (id, last_success_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_kpi_alert_rules_ws
  ON crm_kpi_alert_rules (workspace_id, enabled)
  WHERE deleted_at IS NULL;
