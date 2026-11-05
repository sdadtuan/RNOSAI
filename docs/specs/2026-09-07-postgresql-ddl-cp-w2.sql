CREATE TABLE IF NOT EXISTS crm_cp_brand_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_version_id UUID NOT NULL REFERENCES crm_cp_brand_kit_versions(id),
  condition_json JSONB NOT NULL,
  action_json JSONB NOT NULL,
  enforcement TEXT NOT NULL,
  CONSTRAINT crm_cp_rule_enf_chk CHECK (enforcement IN ('block_render','block_publish','warning'))
);

CREATE TABLE IF NOT EXISTS crm_cp_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type TEXT NOT NULL,
  object_id UUID NOT NULL,
  step TEXT NOT NULL,
  actor_id INTEGER,
  decision TEXT,
  reason TEXT,
  at TIMESTAMPTZ,
  CONSTRAINT crm_cp_appr_step_chk CHECK (
    step IN ('internal_review','client_review','brand','legal','final')
  )
);

CREATE TABLE IF NOT EXISTS crm_cp_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type TEXT NOT NULL,
  object_id UUID NOT NULL,
  timecode_ms INTEGER,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  mention_ids INTEGER[] NOT NULL DEFAULT '{}',
  created_by INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_cp_channel_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL UNIQUE,
  rules_json JSONB NOT NULL
);
INSERT INTO crm_cp_channel_profiles (channel, rules_json) VALUES
  ('tiktok', '{"ratio":["9:16"],"duration_sec":[15,60],"caption_max":2200}'),
  ('reels', '{"ratio":["9:16","1:1"],"duration_sec":[15,90],"caption_max":2200}')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS crm_cp_publish_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_version_id UUID NOT NULL REFERENCES crm_cp_video_versions(id),
  channel TEXT NOT NULL,
  profile_id UUID REFERENCES crm_cp_channel_profiles(id),
  scheduled_at TIMESTAMPTZ,
  tz TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  copy TEXT,
  hashtags TEXT,
  thumbnail_asset_id UUID,
  cta TEXT,
  utm_json JSONB,
  audience TEXT,
  compliance_label TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  post_ref TEXT,
  last_error TEXT,
  CONSTRAINT crm_cp_pub_status_chk CHECK (
    status IN ('draft','scheduled','publishing','published','failed','cancelled')
  )
);
