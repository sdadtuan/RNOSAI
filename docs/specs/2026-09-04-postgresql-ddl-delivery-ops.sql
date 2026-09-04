BEGIN;

-- Minimal resources table (Wave C dependency for capacity overlap)
CREATE TABLE IF NOT EXISTS crm_delivery_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_delivery_projects (id) ON DELETE CASCADE,
  staff_id INT NOT NULL,
  role_name TEXT,
  team_name TEXT,
  allocation_pct NUMERIC NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  estimated_cost NUMERIC,
  overload_reason TEXT,
  row_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS crm_delivery_resources_staff_idx
  ON crm_delivery_resources (staff_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS crm_delivery_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_delivery_projects (id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  owner_staff_id INT,
  sla_due TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'mitigated', 'closed')),
  note TEXT,
  row_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS crm_delivery_risks_project_idx
  ON crm_delivery_risks (project_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS crm_delivery_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_delivery_projects (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('scope', 'budget')),
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
  baseline_version INT NOT NULL DEFAULT 0,
  note TEXT,
  created_by_staff_id INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS crm_delivery_change_requests_project_idx
  ON crm_delivery_change_requests (project_id);

CREATE TABLE IF NOT EXISTS crm_delivery_quality_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_delivery_projects (id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  ontime_milestone_pct NUMERIC,
  client_approval_sla NUMERIC,
  rework_pct NUMERIC,
  score NUMERIC,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, period)
);

ALTER TABLE crm_delivery_projects
  ADD COLUMN IF NOT EXISTS needs_finance BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cadence_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE crm_delivery_milestones
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewer_staff_id INT;

COMMIT;
