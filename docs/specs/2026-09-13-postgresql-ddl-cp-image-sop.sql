-- PTT Image SOP — img_* tables (SPEC §4.1)
-- Apply: bash scripts/apply_pg_ddl_cp_image_sop.sh

-- Registry SOP-as-Code
CREATE TABLE IF NOT EXISTS img_sop_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  risk_tier TEXT NOT NULL DEFAULT 'MEDIUM',
  data_class TEXT NOT NULL DEFAULT 'INTERNAL',
  owner_staff_id INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS img_sop_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_id UUID NOT NULL REFERENCES img_sop_registry(id),
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  manifest_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  prompt_package_id UUID REFERENCES crm_cp_prompt_packages(id),
  quality_profile_key TEXT,
  routing_policy_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ,
  UNIQUE (sop_id, version)
);

-- Creative task / project
CREATE TABLE IF NOT EXISTS img_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  cp_project_id UUID REFERENCES crm_cp_projects(id),
  agency_client_id INT NOT NULL,
  service_lifecycle_id UUID,
  sop_version_id UUID REFERENCES img_sop_versions(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  brief_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  brand_kit_id UUID,
  brand_kit_version INT,
  g1_at TIMESTAMPTZ,
  g2_at TIMESTAMPTZ,
  g3_at TIMESTAMPTZ,
  created_by_staff_id INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS img_projects_tenant_status_idx
  ON img_projects (tenant_id, status);

CREATE TABLE IF NOT EXISTS img_frames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES img_projects(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  label TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL,
  prompt TEXT NOT NULL DEFAULT '',
  negative_prompt TEXT NOT NULL DEFAULT '',
  variant_target INT NOT NULL DEFAULT 2,
  intent TEXT NOT NULL DEFAULT 'hero_lifestyle',
  creative_genome_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  master_asset_id UUID REFERENCES crm_cp_assets(id),
  winner_asset_id UUID REFERENCES crm_cp_assets(id),
  format_pack_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS img_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES img_projects(id),
  frame_id UUID REFERENCES img_frames(id),
  cp_render_job_id UUID REFERENCES crm_cp_render_jobs(id),
  provider TEXT NOT NULL,
  route_decision_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  state TEXT NOT NULL DEFAULT 'DRAFT',
  estimate_credits INT,
  output_asset_id UUID REFERENCES crm_cp_assets(id),
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS img_job_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES img_jobs(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  capability TEXT NOT NULL,
  provider TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'PENDING',
  input_asset_ids UUID[] NOT NULL DEFAULT '{}',
  output_asset_id UUID REFERENCES crm_cp_assets(id),
  cp_render_job_id UUID REFERENCES crm_cp_render_jobs(id),
  estimate_credits INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS img_job_stages_job_sort_idx
  ON img_job_stages (job_id, sort_order);

CREATE TABLE IF NOT EXISTS img_gate_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES img_projects(id),
  gate_num INT NOT NULL CHECK (gate_num BETWEEN 1 AND 3),
  action TEXT NOT NULL,
  actor_staff_id INT NOT NULL,
  checklist_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS img_quality_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES crm_cp_assets(id),
  profile_key TEXT NOT NULL,
  scores_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS img_brand_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_kit_id UUID NOT NULL,
  rule_key TEXT NOT NULL,
  enforcement TEXT NOT NULL,
  rule_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- Idempotent seed: 5 flagship SOPs + v0.1 versions (SPEC §7.1)
INSERT INTO img_sop_registry (code, name, category, status, risk_tier, data_class)
VALUES
  ('PTT-IMG-KV-45', 'Brand KV 4:5', 'BRAND_KEY_VISUAL', 'DRAFT', 'MEDIUM', 'INTERNAL'),
  ('PTT-IMG-SOCIAL-916', 'Social 9:16 Still', 'SOCIAL', 'STAGING', 'MEDIUM', 'INTERNAL'),
  ('PTT-IMG-PACKSHOT-11', 'Packshot Comfy', 'PRODUCT_PACKSHOT', 'DRAFT', 'MEDIUM', 'INTERNAL'),
  ('PTT-IMG-FOOD-WEAVE', 'Food Weave WO', 'HUMAN_ART', 'DRAFT', 'LOW', 'INTERNAL'),
  ('PTT-IMG-MASTER-UPSCALE', 'Master Upscale', 'UPSCALE', 'DRAFT', 'LOW', 'INTERNAL')
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO img_sop_versions (sop_id, version, status, manifest_json, quality_profile_key)
SELECT r.id, 'v0.1', 'DRAFT', v.manifest_json, v.quality_profile_key
FROM img_sop_registry r
JOIN (VALUES
  ('PTT-IMG-KV-45', '{"recipe_stages":[{"stage":"explore","capability":"images_generate","provider":"magnific_rest","required":true,"estimate_credits":4},{"stage":"select","capability":"manual","provider":"local","required":true},{"stage":"refine","capability":"weave_refine","provider":"weavy","required":false},{"stage":"upscale","capability":"images_upscale","provider":"magnific_rest","required":true},{"stage":"pack","capability":"images_crop","provider":"magnific_rest","required":true},{"stage":"qc","capability":"brand_kv_v1","provider":"local","required":true}]}'::jsonb, 'brand_kv_v1'),
  ('PTT-IMG-SOCIAL-916', '{"recipe_stages":[{"stage":"explore","capability":"images_generate","provider":"magnific_rest","required":true,"estimate_credits":4},{"stage":"select","capability":"manual","provider":"local","required":true},{"stage":"upscale","capability":"images_upscale","provider":"magnific_rest","required":true},{"stage":"pack","capability":"images_crop","provider":"magnific_rest","required":true},{"stage":"qc","capability":"social_cta_vn_v1","provider":"local","required":true}]}'::jsonb, 'social_cta_vn_v1'),
  ('PTT-IMG-PACKSHOT-11', '{"recipe_stages":[{"stage":"explore","capability":"comfy_packshot","provider":"comfyui","required":true},{"stage":"select","capability":"manual","provider":"local","required":true},{"stage":"refine","capability":"images_remove_background","provider":"magnific_rest","required":true},{"stage":"pack","capability":"images_crop","provider":"magnific_rest","required":true},{"stage":"qc","capability":"product_fidelity_v2","provider":"local","required":true}]}'::jsonb, 'product_fidelity_v2'),
  ('PTT-IMG-FOOD-WEAVE', '{"recipe_stages":[{"stage":"explore","capability":"weave_wo","provider":"weavy","required":true},{"stage":"select","capability":"manual","provider":"local","required":true},{"stage":"upscale","capability":"images_upscale","provider":"magnific_rest","required":true},{"stage":"pack","capability":"images_crop","provider":"magnific_rest","required":true},{"stage":"qc","capability":"brand_kv_v1","provider":"local","required":true}]}'::jsonb, 'brand_kv_v1'),
  ('PTT-IMG-MASTER-UPSCALE', '{"recipe_stages":[{"stage":"upscale","capability":"images_upscale","provider":"magnific_rest","required":true},{"stage":"qc","capability":"brand_kv_v1","provider":"local","required":true}]}'::jsonb, 'brand_kv_v1')
) AS v(code, manifest_json, quality_profile_key) ON r.code = v.code
ON CONFLICT (sop_id, version) DO NOTHING;
