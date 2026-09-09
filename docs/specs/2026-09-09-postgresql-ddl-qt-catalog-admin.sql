-- QT Service Catalog admin: editable groups + service group_key.
-- Apply: ./scripts/apply_pg_ddl_qt_catalog_admin.sh

BEGIN;

CREATE TABLE IF NOT EXISTS crm_catalog_groups (
  key          VARCHAR(40) PRIMARY KEY,
  title        VARCHAR(200) NOT NULL,
  description  VARCHAR(500) NOT NULL DEFAULT '',
  icon         VARCHAR(16) NOT NULL DEFAULT '▣',
  sort_order   INT NOT NULL DEFAULT 0,
  system       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE crm_catalog_services
  ADD COLUMN IF NOT EXISTS group_key VARCHAR(40),
  ADD COLUMN IF NOT EXISTS recommended BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS client_visible BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_crm_catalog_services_group_key
  ON crm_catalog_services (group_key);

INSERT INTO crm_catalog_groups (key, title, description, icon, sort_order, system) VALUES
  ('strategy', 'Strategy & Research', 'Discovery, audit, research, strategy, GTM và consulting.', '✦', 1, TRUE),
  ('branding', 'Branding & Creative', 'Định vị, nhận diện, creative concept và brand asset.', '◇', 2, TRUE),
  ('content', 'Content & Social', 'Content strategy, social operation, copywriting và community.', '✎', 3, TRUE),
  ('production', 'Video & Image Production', 'Pre-production, video, image, motion và livestream.', '▶', 4, TRUE),
  ('performance', 'Performance & Media', 'Paid media, media buying, TMĐT và growth ads.', '◉', 5, TRUE),
  ('web', 'Web, Landing Page & CRO', 'UX/UI, website, landing page, tracking và CRO.', '▣', 6, TRUE),
  ('seo', 'SEO, AEO/GEO & Organic', 'Technical SEO, content SEO, local SEO và AI-search.', '⌕', 7, TRUE),
  ('crm', 'CRM, Automation & AI', 'CRM, lead routing, automation, chatbot và dashboard.', '♟', 8, TRUE),
  ('retention', 'Email & Retention', 'Lifecycle, nurture, reactivation và reminders.', '↻', 9, TRUE),
  ('pr', 'PR, KOL & Reputation', 'PR, media relations, KOL/KOC và ORM.', '◌', 10, TRUE),
  ('event', 'Event & Activation', 'Event, launch, activation, roadshow và POSM.', '★', 11, TRUE),
  ('sales', 'Sales Enablement B2B', 'Sales deck, ABM, outreach và pitch support. Không phải DV mới mặc định.', '↗', 12, TRUE),
  ('data', 'Data & Analytics', 'GA4/GTM, attribution, reporting và dashboard.', '▤', 13, TRUE),
  ('package', 'Package theo ngành', 'Gói N line DV + discount, không tạo family mới.', '▣', 14, TRUE)
ON CONFLICT (key) DO NOTHING;

UPDATE crm_catalog_services SET group_key = CASE upper(btrim(dv_code))
  WHEN 'DV01' THEN 'branding'
  WHEN 'DV02' THEN 'content'
  WHEN 'DV03' THEN 'web'
  WHEN 'DV04' THEN 'performance'
  WHEN 'DV05' THEN 'seo'
  WHEN 'DV06' THEN 'retention'
  WHEN 'DV07' THEN 'crm'
  WHEN 'DV08' THEN 'crm'
  WHEN 'DV09' THEN 'crm'
  WHEN 'DV10' THEN 'crm'
  WHEN 'DV11' THEN 'crm'
  WHEN 'DV12' THEN 'strategy'
  WHEN 'DV13' THEN 'data'
  WHEN 'DV14' THEN 'pr'
  WHEN 'DV15' THEN 'production'
  WHEN 'DV16' THEN 'pr'
  WHEN 'DV17' THEN 'event'
  WHEN 'DV18' THEN 'performance'
  WHEN 'DV19' THEN 'performance'
  WHEN 'DV20' THEN 'retention'
  WHEN 'DV21' THEN 'event'
  ELSE group_key
END
WHERE group_key IS NULL AND dv_code IS NOT NULL AND btrim(dv_code) <> '';

COMMIT;
