CREATE TABLE IF NOT EXISTS crm_cp_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_cp_projects(id),
  name TEXT NOT NULL,
  variants_json JSONB NOT NULL
);

ALTER TABLE crm_cp_settings
  ADD COLUMN IF NOT EXISTS routing_json JSONB NOT NULL DEFAULT '{}';
