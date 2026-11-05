BEGIN;

CREATE TABLE IF NOT EXISTS crm_delivery_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  capabilities TEXT[] NOT NULL DEFAULT ARRAY['delivery']::TEXT[],
  b2b_project_id UUID UNIQUE REFERENCES crm_b2b_projects (id),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending_approval','approved','active','on_hold','completed','closed','cancelled')),
  customer_id BIGINT,
  agency_client_id BIGINT,
  lead_id BIGINT,
  contract_id BIGINT,
  lifecycle_id BIGINT,
  project_type TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'normal',
  pm_staff_id INT,
  am_staff_id INT,
  start_date DATE,
  end_date DATE,
  description TEXT NOT NULL DEFAULT '',
  health_status TEXT NOT NULL DEFAULT 'no_data',
  health_components_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_version INT NOT NULL DEFAULT 0,
  created_by_staff_id INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  row_version INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS crm_delivery_project_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_delivery_projects (id) ON DELETE CASCADE,
  service_code TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (project_id, service_code)
);

CREATE TABLE IF NOT EXISTS crm_delivery_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_delivery_projects (id) ON DELETE CASCADE,
  service_code TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity TEXT NOT NULL DEFAULT '',
  acceptance TEXT NOT NULL DEFAULT '',
  owner_staff_id INT,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS crm_delivery_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_delivery_projects (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  start_date DATE,
  due_date DATE,
  owner_staff_id INT,
  status TEXT NOT NULL DEFAULT 'planned',
  acceptance TEXT NOT NULL DEFAULT '',
  weight NUMERIC,
  UNIQUE (project_id, code)
);

CREATE TABLE IF NOT EXISTS crm_delivery_milestone_deps (
  project_id UUID NOT NULL REFERENCES crm_delivery_projects (id) ON DELETE CASCADE,
  from_code TEXT NOT NULL,
  to_code TEXT NOT NULL,
  PRIMARY KEY (project_id, from_code, to_code),
  CHECK (from_code <> to_code)
);

CREATE TABLE IF NOT EXISTS crm_delivery_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_delivery_projects (id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES crm_delivery_milestones (id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS crm_delivery_wizard_drafts (
  project_id UUID PRIMARY KEY REFERENCES crm_delivery_projects (id) ON DELETE CASCADE,
  step INT NOT NULL DEFAULT 1,
  state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO crm_delivery_projects (name, capabilities, b2b_project_id, status, health_status, pm_staff_id)
SELECT b.name,
       ARRAY['lead_ingest']::TEXT[],
       b.id,
       'draft',
       CASE WHEN b.status = 'active' THEN 'stable' WHEN b.status = 'paused' THEN 'needs_attention' ELSE 'no_data' END,
       NULL
FROM crm_b2b_projects b
WHERE b.id NOT IN (SELECT b2b_project_id FROM crm_delivery_projects WHERE b2b_project_id IS NOT NULL)
ON CONFLICT (b2b_project_id) DO NOTHING;

COMMIT;
