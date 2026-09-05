-- AM-20260905-w3

CREATE TABLE IF NOT EXISTS crm_am_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  agency_client_id UUID NOT NULL,
  kind TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  actor_staff_id INTEGER,
  summary TEXT NOT NULL,
  sentiment TEXT,
  visibility TEXT NOT NULL DEFAULT 'internal',
  attendees_json JSONB,
  action_items_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_am_interactions_kind_chk CHECK (
    kind IN ('note','call','meeting','email','system')
  )
);

CREATE TABLE IF NOT EXISTS crm_am_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  agency_client_id UUID NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  probability INTEGER,
  impact INTEGER,
  evidence TEXT NOT NULL,
  owner_staff_id INTEGER,
  due_on DATE,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_am_recovery_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  agency_client_id UUID NOT NULL,
  risk_id UUID,
  goal TEXT NOT NULL,
  rca TEXT,
  actions_json JSONB NOT NULL,
  exit_criteria TEXT,
  outcome TEXT,
  lesson TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_am_interactions_tenant_client_idx
  ON crm_am_interactions (tenant_id, agency_client_id);

CREATE INDEX IF NOT EXISTS crm_am_risks_tenant_client_idx
  ON crm_am_risks (tenant_id, agency_client_id);

CREATE INDEX IF NOT EXISTS crm_am_recovery_plans_tenant_client_idx
  ON crm_am_recovery_plans (tenant_id, agency_client_id);

ALTER TABLE crm_am_tasks
  ADD COLUMN IF NOT EXISTS csd_ticket_id UUID,
  ADD COLUMN IF NOT EXISTS escalation_level TEXT,
  ADD COLUMN IF NOT EXISTS resolution_summary TEXT,
  ADD COLUMN IF NOT EXISTS resolution_category TEXT;
