-- Performance OS — assignments, scorecards, check-ins, snapshots
-- Migration: 2026-09-10-performance-os

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
BEGIN;

CREATE TABLE IF NOT EXISTS crm_pm_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  definition_code TEXT NOT NULL,
  name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL DEFAULT '',
  scope_name TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  direction TEXT NOT NULL,
  target NUMERIC NOT NULL,
  target_min NUMERIC,
  target_stretch NUMERIC,
  assigned_target NUMERIC NOT NULL,
  quoted_target NUMERIC,
  source_id TEXT,
  instance_id TEXT,
  collection_method TEXT NOT NULL DEFAULT 'manual',
  quality TEXT NOT NULL DEFAULT 'pending',
  lifecycle TEXT NOT NULL DEFAULT 'draft',
  client_visible BOOLEAN NOT NULL DEFAULT FALSE,
  disclaimer TEXT NOT NULL DEFAULT '',
  assumption_open BOOLEAN NOT NULL DEFAULT FALSE,
  period_start DATE,
  period_end DATE,
  period_label TEXT NOT NULL DEFAULT '',
  cycle TEXT NOT NULL DEFAULT 'Tháng',
  row_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT crm_pm_asg_scope_chk CHECK (
    scope_type IN ('individual','team','department','project','client','campaign','service')
  ),
  CONSTRAINT crm_pm_asg_quality_chk CHECK (quality IN ('verified','pending','stale')),
  CONSTRAINT crm_pm_asg_life_chk CHECK (lifecycle IN ('draft','active','tracking','closed')),
  CONSTRAINT crm_pm_asg_method_chk CHECK (collection_method IN ('manual','api','connector'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_pm_asg_key
  ON crm_pm_assignments (tenant_id, definition_code, scope_type, scope_id, period_label)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS crm_pm_scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  title TEXT NOT NULL,
  card_type TEXT NOT NULL DEFAULT 'role',
  owner_name TEXT NOT NULL,
  period_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  weight_total NUMERIC NOT NULL DEFAULT 0,
  inherit_ref TEXT,
  approver TEXT NOT NULL DEFAULT '',
  row_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT crm_pm_sc_status_chk CHECK (status IN ('draft','pending','active','closed'))
);

CREATE TABLE IF NOT EXISTS crm_pm_scorecard_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  scorecard_id UUID NOT NULL REFERENCES crm_pm_scorecards(id),
  assignment_id UUID REFERENCES crm_pm_assignments(id),
  definition_code TEXT NOT NULL,
  name TEXT NOT NULL,
  weight NUMERIC NOT NULL,
  formula_snapshot TEXT NOT NULL DEFAULT '',
  target_label TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS crm_pm_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  assignment_id UUID NOT NULL REFERENCES crm_pm_assignments(id),
  forecast TEXT,
  blocker TEXT,
  evidence TEXT,
  note TEXT NOT NULL DEFAULT '',
  review_state TEXT NOT NULL DEFAULT 'submitted',
  review_comment TEXT,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT crm_pm_ck_review_chk CHECK (
    review_state IN ('submitted','approved','returned','escalated')
  )
);

CREATE TABLE IF NOT EXISTS crm_pm_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  assignment_id UUID NOT NULL REFERENCES crm_pm_assignments(id),
  title TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  due_at TIMESTAMPTZ,
  impact TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_pm_actuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  assignment_id UUID NOT NULL REFERENCES crm_pm_assignments(id),
  value NUMERIC NOT NULL,
  quality TEXT NOT NULL,
  collection_method TEXT NOT NULL,
  supersedes UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_pm_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  scorecard_id UUID NOT NULL REFERENCES crm_pm_scorecards(id),
  period_label TEXT NOT NULL,
  hash TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scorecard_id, period_label)
);

CREATE TABLE IF NOT EXISTS crm_pm_policy (
  tenant_id TEXT PRIMARY KEY,
  score_cap TEXT NOT NULL DEFAULT '100',
  green_min NUMERIC NOT NULL DEFAULT 90,
  yellow_min NUMERIC NOT NULL DEFAULT 70,
  effective_at DATE,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_pm_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_pm_idempotency (
  key TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
