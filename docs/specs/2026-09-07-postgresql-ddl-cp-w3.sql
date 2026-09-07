CREATE TABLE IF NOT EXISTS crm_cp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  variables_json JSONB NOT NULL DEFAULT '[]',
  rules_json JSONB NOT NULL DEFAULT '{}',
  brand_kit_id UUID,
  status TEXT NOT NULL DEFAULT 'draft',
  CONSTRAINT crm_cp_tpl_status_chk CHECK (status IN ('draft','published','archived'))
);

CREATE TABLE IF NOT EXISTS crm_cp_batch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES crm_cp_templates(id),
  project_id UUID REFERENCES crm_cp_projects(id),
  estimate_credits INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_cp_batch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES crm_cp_batch_jobs(id) ON DELETE CASCADE,
  row_no INTEGER NOT NULL,
  row_json JSONB NOT NULL,
  mapping_json JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  job_id UUID,
  UNIQUE (batch_id, row_no)
);

CREATE TABLE IF NOT EXISTS crm_cp_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  name TEXT NOT NULL,
  smart_filter_json JSONB,
  created_by INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS crm_cp_collection_items (
  collection_id UUID NOT NULL REFERENCES crm_cp_collections(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES crm_cp_assets(id),
  PRIMARY KEY (collection_id, asset_id)
);
