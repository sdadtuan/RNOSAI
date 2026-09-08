CREATE SEQUENCE IF NOT EXISTS crm_quote_code_seq;

CREATE TABLE IF NOT EXISTS crm_quote_settings (
  tenant_id TEXT PRIMARY KEY DEFAULT 'PTT',
  quote_code_pattern TEXT NOT NULL DEFAULT 'QT-PTT-{YYYY}-{SEQ:6}',
  validity_days INTEGER NOT NULL DEFAULT 30,
  vat_bps INTEGER NOT NULL DEFAULT 800,
  currency_code TEXT NOT NULL DEFAULT 'VND',
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  issuing_entity TEXT NOT NULL DEFAULT 'PTT-HCM',
  payment_template TEXT NOT NULL DEFAULT '50/30/20',
  gm_floor_bps INTEGER NOT NULL DEFAULT 2500,
  discount_auto_bps INTEGER NOT NULL DEFAULT 500,
  director_value_vnd BIGINT NOT NULL DEFAULT 200000000,
  payment_term_max_days INTEGER NOT NULL DEFAULT 60,
  share_expiry_days INTEGER NOT NULL DEFAULT 14,
  pdf_download BOOLEAN NOT NULL DEFAULT TRUE,
  otp_required BOOLEAN NOT NULL DEFAULT TRUE,
  view_tracking BOOLEAN NOT NULL DEFAULT TRUE,
  ai_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  policy_json JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by_staff_id INTEGER
);
INSERT INTO crm_quote_settings (tenant_id) VALUES ('PTT') ON CONFLICT DO NOTHING;

-- Base Deal Room tables are created lazily by ptt-crm-api. VPS Postgres never
-- had them (proposals lived in SQLite). Create first, then extend for Quote OS.
CREATE TABLE IF NOT EXISTS crm_proposals (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES crm_customers(id) ON DELETE CASCADE,
  lead_id INTEGER NULL,
  presales_id INTEGER NULL,
  lifecycle_id INTEGER REFERENCES crm_service_lifecycle(id) ON DELETE SET NULL,
  service_slugs TEXT NOT NULL DEFAULT '[]',
  total_vnd BIGINT NOT NULL DEFAULT 0,
  timeline_months INTEGER NOT NULL DEFAULT 1,
  notes TEXT NOT NULL DEFAULT '',
  ai_output TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  valid_until TEXT NULL,
  price_adjustment_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_crm_proposals_customer ON crm_proposals (customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_proposals_lead ON crm_proposals (lead_id);

CREATE TABLE IF NOT EXISTS crm_quote_line_item (
  id SERIAL PRIMARY KEY,
  proposal_id INTEGER NOT NULL REFERENCES crm_proposals(id) ON DELETE CASCADE,
  dv_code TEXT NOT NULL,
  sku_code TEXT NULL,
  package_tier TEXT NOT NULL,
  service_slug TEXT NOT NULL DEFAULT '',
  reference_price_min BIGINT NOT NULL DEFAULT 0,
  reference_price_max BIGINT NOT NULL DEFAULT 0,
  final_price_vnd BIGINT NOT NULL DEFAULT 0,
  scope_notes TEXT NOT NULL DEFAULT '',
  lifecycle_id INTEGER REFERENCES crm_service_lifecycle(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_crm_quote_line_proposal
  ON crm_quote_line_item (proposal_id);

ALTER TABLE crm_proposals
  ADD COLUMN IF NOT EXISTS quote_code TEXT,
  ADD COLUMN IF NOT EXISTS agency_client_id UUID,
  ADD COLUMN IF NOT EXISTS current_version_id UUID,
  ADD COLUMN IF NOT EXISTS quote_type TEXT NOT NULL DEFAULT 'new_business',
  ADD COLUMN IF NOT EXISTS issuing_entity TEXT NOT NULL DEFAULT 'PTT-HCM',
  ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'VND',
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS objective TEXT,
  ADD COLUMN IF NOT EXISTS audience TEXT,
  ADD COLUMN IF NOT EXISTS campaign_period TEXT,
  ADD COLUMN IF NOT EXISTS owner_staff_id INTEGER,
  ADD COLUMN IF NOT EXISTS co_owner_staff_ids JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS confidentiality_level TEXT NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS row_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS crm_proposals_quote_code_uq
  ON crm_proposals (quote_code) WHERE quote_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_proposals_agency_client_idx
  ON crm_proposals (agency_client_id);
CREATE INDEX IF NOT EXISTS crm_proposals_owner_idx
  ON crm_proposals (owner_staff_id);

DO $$ BEGIN
  ALTER TABLE crm_proposals
    ADD CONSTRAINT crm_proposals_agency_client_fk
    FOREIGN KEY (agency_client_id) REFERENCES clients(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE crm_quote_line_item
  ADD COLUMN IF NOT EXISTS option_key TEXT,
  ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'fee',
  ADD COLUMN IF NOT EXISTS qty NUMERIC(12,2) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS unit_price_vnd BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_vnd BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS media_amount_vnd BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_vnd BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_labor_vnd BIGINT,
  ADD COLUMN IF NOT EXISTS cost_outsource_vnd BIGINT,
  ADD COLUMN IF NOT EXISTS cost_other_vnd BIGINT,
  ADD COLUMN IF NOT EXISTS client_visible BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS catalog_snapshot_json JSONB NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS crm_quote_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id INTEGER NOT NULL REFERENCES crm_proposals(id),
  n INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'working',
  snapshot_json JSONB NOT NULL DEFAULT '{}',
  fee_vnd BIGINT NOT NULL DEFAULT 0,
  media_vnd BIGINT NOT NULL DEFAULT 0,
  discount_vnd BIGINT NOT NULL DEFAULT 0,
  tax_vnd BIGINT NOT NULL DEFAULT 0,
  payable_vnd BIGINT NOT NULL DEFAULT 0,
  nsr_vnd BIGINT,
  direct_cost_vnd BIGINT,
  gm_bps INTEGER,
  recommended_option_key TEXT,
  valid_until TIMESTAMPTZ,
  created_by INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, n),
  CONSTRAINT crm_quote_versions_state_chk CHECK (
    state IN ('working','submitted','approved','published','accepted','superseded')
  )
);

CREATE TABLE IF NOT EXISTS crm_quote_payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES crm_quote_versions(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  pct_bps INTEGER NOT NULL,
  amount_vnd BIGINT NOT NULL,
  milestone TEXT NOT NULL,
  UNIQUE (version_id, seq)
);

CREATE TABLE IF NOT EXISTS crm_quote_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  proposal_id INTEGER NOT NULL REFERENCES crm_proposals(id),
  version_id UUID,
  actor_staff_id INTEGER,
  actor_kind TEXT NOT NULL DEFAULT 'staff',
  action TEXT NOT NULL,
  resource TEXT,
  snapshot_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_quote_activity_proposal_idx
  ON crm_quote_activity (proposal_id, created_at DESC);

CREATE TABLE IF NOT EXISTS crm_quote_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES crm_quote_versions(id),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (version_id, target_type)
);

CREATE TABLE IF NOT EXISTS crm_quote_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES crm_quote_versions(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);
