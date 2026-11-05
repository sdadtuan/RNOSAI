-- P13.c extend Quote OS. Adds columns only. Does not create crm_quotes.
-- crm_pricing_settings.discount_approval_threshold_pct is left unused.
-- Down: docs/specs/2026-10-03-p13-05-quotes.down.sql

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(64) PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

ALTER TABLE crm_proposals
  ADD COLUMN IF NOT EXISTS pricing_source TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS pricing_version_id UUID,
  ADD COLUMN IF NOT EXISTS pricing_params_version INTEGER,
  ADD COLUMN IF NOT EXISTS pricing_snapshot_json JSONB,
  ADD COLUMN IF NOT EXISTS display_mode TEXT NOT NULL DEFAULT 'package_with_scope',
  ADD COLUMN IF NOT EXISTS validity_days INTEGER,
  ADD COLUMN IF NOT EXISTS issued_at DATE,
  ADD COLUMN IF NOT EXISTS fee_subtotal BIGINT,
  ADD COLUMN IF NOT EXISTS extra_discount_pct NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS extra_discount_amount BIGINT,
  ADD COLUMN IF NOT EXISTS fee_after_discount BIGINT,
  ADD COLUMN IF NOT EXISTS vat_pct NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS fee_vat BIGINT,
  ADD COLUMN IF NOT EXISTS fee_total BIGINT,
  ADD COLUMN IF NOT EXISTS fee_vnd BIGINT,
  ADD COLUMN IF NOT EXISTS effective_discount_pct NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS ad_budget_total BIGINT,
  ADD COLUMN IF NOT EXISTS ads_fee_total BIGINT,
  ADD COLUMN IF NOT EXISTS third_party_total BIGINT,
  ADD COLUMN IF NOT EXISTS booking_fee_total BIGINT,
  ADD COLUMN IF NOT EXISTS passthrough_vat BIGINT,
  ADD COLUMN IF NOT EXISTS passthrough_total BIGINT,
  ADD COLUMN IF NOT EXISTS grand_total BIGINT,
  ADD COLUMN IF NOT EXISTS list_fee_total BIGINT,
  ADD COLUMN IF NOT EXISTS cost_total BIGINT,
  ADD COLUMN IF NOT EXISTS margin_pct_effective NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS gm_bps INTEGER,
  ADD COLUMN IF NOT EXISTS needs_approval BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS p13_approval_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS approval_reasons JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS approval_requested_by TEXT,
  ADD COLUMN IF NOT EXISTS approval_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_note TEXT,
  ADD COLUMN IF NOT EXISTS sent_channel TEXT,
  ADD COLUMN IF NOT EXISTS sent_evidence_url TEXT,
  ADD COLUMN IF NOT EXISTS accepted_evidence_url TEXT,
  ADD COLUMN IF NOT EXISTS accepted_by_contact TEXT,
  ADD COLUMN IF NOT EXISTS rejected_reason TEXT,
  ADD COLUMN IF NOT EXISTS payment_terms_json JSONB,
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS warnings_json JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS p13_version_n INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS shared_staff_ids JSONB NOT NULL DEFAULT '[]';

UPDATE crm_proposals SET pricing_source = 'legacy' WHERE pricing_source IS NULL OR pricing_source = '';

ALTER TABLE crm_quote_line_item
  ADD COLUMN IF NOT EXISTS pricing_source TEXT,
  ADD COLUMN IF NOT EXISTS p13_line_type TEXT,
  ADD COLUMN IF NOT EXISTS service_id BIGINT,
  ADD COLUMN IF NOT EXISTS level_code TEXT,
  ADD COLUMN IF NOT EXISTS service_item_id BIGINT,
  ADD COLUMN IF NOT EXISTS item_qty_overrides_json JSONB,
  ADD COLUMN IF NOT EXISTS list_unit_price BIGINT,
  ADD COLUMN IF NOT EXISTS unit_price_override_reason TEXT,
  ADD COLUMN IF NOT EXISTS discount_pct NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS hours_snapshot NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS cost_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS passthrough_amount BIGINT,
  ADD COLUMN IF NOT EXISTS fee_pct_snapshot NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS fee_min_snapshot BIGINT,
  ADD COLUMN IF NOT EXISTS fee_amount BIGINT,
  ADD COLUMN IF NOT EXISTS price_snapshot_json JSONB,
  ADD COLUMN IF NOT EXISTS warnings_json JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS description TEXT;

CREATE TABLE IF NOT EXISTS crm_p13_settings (
  key TEXT PRIMARY KEY,
  value_json JSONB,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO crm_p13_settings (key, value_json)
VALUES
  ('quote.discount_approval_threshold_pct', 'null'::jsonb),
  ('quote.default_validity_days', '10'::jsonb),
  ('quote.default_display_mode', '"package_with_scope"'::jsonb),
  ('quote.custom_line_requires_approval', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS crm_p13_quote_files (
  id BIGSERIAL PRIMARY KEY,
  proposal_id INTEGER NOT NULL REFERENCES crm_proposals(id) ON DELETE CASCADE,
  version_n INTEGER NOT NULL,
  seq INTEGER NOT NULL,
  kind TEXT NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  renderer_version TEXT NOT NULL,
  data_hash TEXT NOT NULL,
  display_mode TEXT NOT NULL,
  exported_by TEXT,
  exported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (proposal_id, version_n, seq)
);

INSERT INTO schema_migrations (version, description)
VALUES ('2026-10-03-p13-05-quotes', 'P13.c quote columns and quote settings')
ON CONFLICT (version) DO NOTHING;
