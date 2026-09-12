CREATE TABLE IF NOT EXISTS crm_cp_weave_templates (
  template_key TEXT PRIMARY KEY,
  name_vi TEXT NOT NULL,
  weave_flow_url TEXT NOT NULL,
  output_kind TEXT NOT NULL CHECK (output_kind IN ('image', 'video', 'carousel')),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS crm_cp_weave_work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  project_id UUID NOT NULL REFERENCES crm_cp_projects(id),
  lifecycle_id TEXT,
  agency_client_id UUID NOT NULL REFERENCES clients(id),
  deliverable_id UUID,
  template_key TEXT NOT NULL REFERENCES crm_cp_weave_templates(template_key),
  status TEXT NOT NULL DEFAULT 'draft',
  brief_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  task_id TEXT UNIQUE,
  client_code TEXT,
  campaign_code TEXT,
  export_prefix TEXT,
  opened_at TIMESTAMPTZ,
  opened_by_staff_id INT,
  created_by_staff_id INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_cp_weave_wo_tenant_chk CHECK (tenant_id = 'PTT')
);

CREATE TABLE IF NOT EXISTS crm_cp_weave_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES crm_cp_weave_work_orders(id),
  asset_id UUID,
  storage_uri TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('upload', 'prefix_sync', 'link')),
  checksum TEXT,
  lane TEXT,
  width INT,
  height INT,
  duration_ms INT,
  watermark TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_cp_weave_assets_task_checksum_uq
  ON crm_cp_weave_assets (work_order_id, checksum)
  WHERE checksum IS NOT NULL AND checksum <> '';

INSERT INTO crm_cp_weave_templates (template_key, name_vi, weave_flow_url, output_kind, active)
VALUES
  ('feed-1x1', 'Feed vuông 1080', 'https://app.weavy.ai/', 'image', TRUE),
  ('reel-9x16', 'Reel / Shorts', 'https://app.weavy.ai/', 'video', TRUE),
  ('banner-wide', 'Banner ngang', 'https://app.weavy.ai/', 'image', TRUE)
ON CONFLICT (template_key) DO NOTHING;
