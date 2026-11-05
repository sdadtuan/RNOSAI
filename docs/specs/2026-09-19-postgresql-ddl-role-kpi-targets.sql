-- Role KPI targets (AI draft + human approve) — 2026-09-19
-- Applied at runtime via OpsRoleKpiRepository.ensureSchema; this file is source of truth.

CREATE TABLE IF NOT EXISTS crm_role_kpi_targets (
  id              BIGSERIAL PRIMARY KEY,
  plan_id         INTEGER NULL,
  lifecycle_id    INTEGER NULL,
  client_id       UUID NULL,
  campaign_id     INTEGER NULL,
  role_key        TEXT NOT NULL,
  kpi_key         TEXT NOT NULL,
  kpi_label       TEXT NOT NULL DEFAULT '',
  period_start    DATE NULL,
  period_end      DATE NULL,
  target_value    NUMERIC NULL,
  target_unit     TEXT NOT NULL DEFAULT 'count',
  actual_value    NUMERIC NULL,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'review', 'approved', 'locked', 'cancelled')),
  owner_staff_id  TEXT NULL,
  form_data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes           TEXT NOT NULL DEFAULT '',
  upsert_key      TEXT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_role_kpi_targets_plan_role
  ON crm_role_kpi_targets (plan_id, role_key);
CREATE INDEX IF NOT EXISTS idx_crm_role_kpi_targets_lifecycle_role
  ON crm_role_kpi_targets (lifecycle_id, role_key);
CREATE INDEX IF NOT EXISTS idx_crm_role_kpi_targets_status_period
  ON crm_role_kpi_targets (status, period_end);
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_role_kpi_targets_upsert
  ON crm_role_kpi_targets (plan_id, role_key, kpi_key, COALESCE(upsert_key, ''), COALESCE(period_start, '1970-01-01'::date))
  WHERE status <> 'cancelled';
