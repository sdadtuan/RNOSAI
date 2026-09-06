CREATE TABLE IF NOT EXISTS crm_cp_settings (
  tenant_id TEXT PRIMARY KEY DEFAULT 'PTT',
  locale TEXT NOT NULL DEFAULT 'vi-VN',
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  default_brand_kit_id UUID,
  retention_days INTEGER NOT NULL DEFAULT 365,
  signed_url_ttl_min INTEGER NOT NULL DEFAULT 15,
  restore_days INTEGER NOT NULL DEFAULT 30,
  legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
  soft_alert_pct INTEGER NOT NULL DEFAULT 80,
  hard_cap_pct INTEGER NOT NULL DEFAULT 100,
  high_cost_threshold INTEGER NOT NULL DEFAULT 200,
  concurrent_slots INTEGER NOT NULL DEFAULT 5,
  watermark_draft BOOLEAN NOT NULL DEFAULT TRUE,
  ai_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  publish_native BOOLEAN NOT NULL DEFAULT FALSE,
  models_json JSONB NOT NULL DEFAULT '[]',
  policy_json JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by_staff_id INTEGER,
  CONSTRAINT crm_cp_settings_tenant_chk CHECK (tenant_id = 'PTT')
);
INSERT INTO crm_cp_settings (tenant_id) VALUES ('PTT') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS crm_cp_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  agency_client_id UUID NOT NULL REFERENCES clients(id),
  lifecycle_id TEXT,
  owner_staff_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  industry TEXT,
  objective TEXT,
  start_at DATE,
  due_at DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  credit_budget INTEGER,
  cost_center TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_cp_projects_status_chk CHECK (
    status IN ('draft','active','at_risk','in_review','completed','archived')
  ),
  CONSTRAINT crm_cp_projects_tenant_chk CHECK (tenant_id = 'PTT')
);
CREATE INDEX IF NOT EXISTS crm_cp_projects_client_idx
  ON crm_cp_projects (tenant_id, agency_client_id);
CREATE INDEX IF NOT EXISTS crm_cp_projects_owner_idx
  ON crm_cp_projects (tenant_id, owner_staff_id);

CREATE TABLE IF NOT EXISTS crm_cp_project_members (
  project_id UUID NOT NULL REFERENCES crm_cp_projects(id) ON DELETE CASCADE,
  staff_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  invited_until TIMESTAMPTZ,
  PRIMARY KEY (project_id, staff_id)
);

CREATE TABLE IF NOT EXISTS crm_cp_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_cp_projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  body_json JSONB NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'draft',
  created_by INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, version)
);

CREATE TABLE IF NOT EXISTS crm_cp_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_cp_projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  owner_staff_id INTEGER,
  due_at DATE,
  priority TEXT NOT NULL DEFAULT 'normal',
  video_draft_id UUID,
  video_version_id UUID,
  vd_project_id TEXT,
  content_item_id TEXT,
  CONSTRAINT crm_cp_deliv_type_chk CHECK (
    type IN ('ai_video','motion','social','landing_asset','human_video')
  )
);

CREATE TABLE IF NOT EXISTS crm_cp_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_cp_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  assignee_id INTEGER,
  due_at TIMESTAMPTZ,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'open',
  depends_on_id UUID,
  am_task_id UUID,
  csd_ticket_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_cp_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_cp_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_at DATE,
  owner_id INTEGER,
  status TEXT NOT NULL DEFAULT 'open',
  depends_on_id UUID
);

CREATE TABLE IF NOT EXISTS crm_cp_brand_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  scope_type TEXT NOT NULL,
  agency_client_id UUID,
  project_id UUID,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  CONSTRAINT crm_cp_kit_scope_chk CHECK (scope_type IN ('tenant','client','project')),
  CONSTRAINT crm_cp_brand_kits_tenant_chk CHECK (tenant_id = 'PTT')
);

CREATE TABLE IF NOT EXISTS crm_cp_brand_kit_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID NOT NULL REFERENCES crm_cp_brand_kits(id) ON DELETE CASCADE,
  n INTEGER NOT NULL,
  payload_json JSONB NOT NULL,
  approved_by INTEGER,
  approved_at TIMESTAMPTZ,
  UNIQUE (kit_id, n)
);

CREATE TABLE IF NOT EXISTS crm_cp_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  agency_client_id UUID NOT NULL REFERENCES clients(id),
  project_id UUID REFERENCES crm_cp_projects(id),
  owner_staff_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'uploading',
  bytes BIGINT,
  hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_cp_assets_state_chk CHECK (
    state IN ('uploading','processing','ready','quarantined','failed','archived','deleted')
  ),
  CONSTRAINT crm_cp_assets_tenant_chk CHECK (tenant_id = 'PTT')
);

CREATE TABLE IF NOT EXISTS crm_cp_asset_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES crm_cp_assets(id) ON DELETE CASCADE,
  n INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes BIGINT,
  meta_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asset_id, n)
);

CREATE TABLE IF NOT EXISTS crm_cp_asset_rights (
  asset_id UUID PRIMARY KEY REFERENCES crm_cp_assets(id) ON DELETE CASCADE,
  license_type TEXT,
  owner_name TEXT,
  effective_on DATE,
  expiry_on DATE,
  territory TEXT[] NOT NULL DEFAULT '{}',
  channels TEXT[] NOT NULL DEFAULT '{}',
  restriction TEXT,
  model_release BOOLEAN,
  talent_release BOOLEAN,
  proof_asset_id UUID
);

CREATE TABLE IF NOT EXISTS crm_cp_asset_usages (
  asset_version_id UUID NOT NULL REFERENCES crm_cp_asset_versions(id),
  object_type TEXT NOT NULL,
  object_id UUID NOT NULL,
  PRIMARY KEY (asset_version_id, object_type, object_id)
);

CREATE TABLE IF NOT EXISTS crm_cp_video_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_cp_projects(id),
  agency_client_id UUID NOT NULL REFERENCES clients(id),
  deliverable_id UUID,
  name TEXT NOT NULL,
  input_mode TEXT NOT NULL DEFAULT 'prompt',
  prompt TEXT,
  script_json JSONB,
  config_json JSONB NOT NULL DEFAULT '{}',
  brand_kit_version_id UUID,
  revision INTEGER NOT NULL DEFAULT 1,
  autosaved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_cp_draft_mode_chk CHECK (input_mode IN ('prompt','script','url','template'))
);
ALTER TABLE crm_cp_video_drafts
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS crm_cp_scenes (
  draft_id UUID NOT NULL REFERENCES crm_cp_video_drafts(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  title TEXT,
  t_start NUMERIC,
  t_end NUMERIC,
  visual TEXT,
  vo TEXT,
  overlay TEXT,
  locked BOOLEAN NOT NULL DEFAULT FALSE,
  qc TEXT,
  PRIMARY KEY (draft_id, idx)
);

CREATE TABLE IF NOT EXISTS crm_cp_video_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES crm_cp_video_drafts(id),
  version_n INTEGER NOT NULL,
  snapshot_json JSONB NOT NULL,
  qc_status TEXT,
  qc_json JSONB,
  approval_status TEXT NOT NULL DEFAULT 'internal_review',
  immutable BOOLEAN NOT NULL DEFAULT FALSE,
  output_uri TEXT,
  pricing_version TEXT,
  UNIQUE (draft_id, version_n)
);

CREATE TABLE IF NOT EXISTS crm_cp_render_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES crm_cp_video_drafts(id),
  parent_job_id UUID,
  batch_item_id UUID,
  state TEXT NOT NULL DEFAULT 'draft',
  stage TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  provider TEXT NOT NULL DEFAULT 'stub',
  model TEXT,
  priority TEXT NOT NULL DEFAULT 'standard',
  idempotency_key TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  stage_log_json JSONB NOT NULL DEFAULT '[]',
  error_class TEXT,
  attempt INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key),
  CONSTRAINT crm_cp_job_state_chk CHECK (
    state IN ('draft','queued','preparing','rendering','processing','qc','review','completed','failed','cancelled','expired')
  )
);

CREATE TABLE IF NOT EXISTS crm_cp_credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  kind TEXT NOT NULL,
  amount INTEGER NOT NULL,
  agency_client_id UUID,
  project_id UUID,
  job_id UUID,
  cost_center TEXT,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT crm_cp_ledger_kind_chk CHECK (
    kind IN ('grant','reserve','charge','release','refund','adjustment','expiry')
  ),
  CONSTRAINT crm_cp_credit_ledger_tenant_chk CHECK (tenant_id = 'PTT')
);

CREATE TABLE IF NOT EXISTS crm_cp_activity (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  actor_id INTEGER,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  payload_json JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_cp_activity_tenant_chk CHECK (tenant_id = 'PTT')
);

CREATE TABLE IF NOT EXISTS crm_cp_saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  staff_id INTEGER NOT NULL,
  page TEXT NOT NULL,
  name TEXT NOT NULL,
  query_json JSONB NOT NULL,
  shared BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_cp_saved_views_tenant_chk CHECK (tenant_id = 'PTT')
);

CREATE TABLE IF NOT EXISTS crm_cp_credit_allocations (
  agency_client_id UUID PRIMARY KEY REFERENCES clients(id),
  allocated INTEGER NOT NULL DEFAULT 0,
  alert_soft_pct INTEGER NOT NULL DEFAULT 80,
  hard_block BOOLEAN NOT NULL DEFAULT TRUE
);
