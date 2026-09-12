ALTER TABLE crm_cp_render_jobs
  ALTER COLUMN draft_id DROP NOT NULL;
ALTER TABLE crm_cp_render_jobs
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES crm_cp_projects(id);
ALTER TABLE crm_cp_render_jobs
  ADD COLUMN IF NOT EXISTS task_id UUID;
ALTER TABLE crm_cp_render_jobs
  ADD COLUMN IF NOT EXISTS brand_kit_version_id UUID;
ALTER TABLE crm_cp_credit_ledger
  ADD COLUMN IF NOT EXISTS provider TEXT;

ALTER TABLE crm_cp_render_jobs DROP CONSTRAINT IF EXISTS crm_cp_job_state_chk;
ALTER TABLE crm_cp_render_jobs ADD CONSTRAINT crm_cp_job_state_chk CHECK (
  state IN (
    'draft','pending_confirm','queued','preparing','rendering','processing',
    'qc','review','completed','failed','cancelled','expired'
  )
);

ALTER TABLE crm_cp_render_jobs DROP CONSTRAINT IF EXISTS crm_cp_job_scope_chk;
ALTER TABLE crm_cp_render_jobs ADD CONSTRAINT crm_cp_job_scope_chk CHECK (
  draft_id IS NOT NULL OR project_id IS NOT NULL
);

CREATE TABLE IF NOT EXISTS crm_cp_provider_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  provider TEXT NOT NULL CHECK (provider IN (
    'magnific_mcp','magnific_rest','comfyui','weavy'
  )),
  status TEXT NOT NULL DEFAULT 'off',
  account_label TEXT,
  secret_ref TEXT,
  expires_at TIMESTAMPTZ,
  created_by_staff_id INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_cp_provider_connections_tenant_chk CHECK (tenant_id = 'PTT')
);

CREATE TABLE IF NOT EXISTS crm_cp_provider_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES crm_cp_render_jobs(id),
  work_order_id UUID,
  provider TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'manual',
  external_run_id TEXT,
  tool_or_workflow TEXT,
  request_redacted_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_redacted_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimate_credits INT,
  actual_credits INT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'started',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_cp_prompt_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_cp_projects(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  current_version INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS crm_cp_prompt_package_versions (
  package_id UUID NOT NULL REFERENCES crm_cp_prompt_packages(id) ON DELETE CASCADE,
  n INT NOT NULL,
  payload_json JSONB NOT NULL,
  approved_by INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (package_id, n)
);

CREATE TABLE IF NOT EXISTS crm_cp_provider_template_map (
  template_id UUID NOT NULL,
  provider TEXT NOT NULL,
  external_ref TEXT NOT NULL,
  bindings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (template_id, provider)
);

CREATE TABLE IF NOT EXISTS crm_cp_workflow_bindings (
  template_id UUID NOT NULL,
  version TEXT NOT NULL,
  bindings_json JSONB NOT NULL,
  fixture_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (template_id, version)
);
