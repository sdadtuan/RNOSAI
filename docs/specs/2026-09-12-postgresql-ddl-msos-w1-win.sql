-- docs/specs/2026-09-12-postgresql-ddl-msos-w1-win.sql
-- Media Supply & Outcome OS W1 + WIN-A. No CRM/invoice clone. No demo seed.
CREATE TABLE IF NOT EXISTS msos_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code TEXT NOT NULL UNIQUE,
  legal_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','watchlist','suspended')),
  kyc_pass BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT
);

CREATE TABLE IF NOT EXISTS msos_inventories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  owner_kind TEXT NOT NULL CHECK (owner_kind IN ('ptt','partner')),
  partner_id UUID REFERENCES msos_partners(id),
  property_host TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','available','low','suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((owner_kind = 'ptt' AND partner_id IS NULL) OR (owner_kind = 'partner' AND partner_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS msos_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES msos_inventories(id),
  name TEXT NOT NULL,
  format TEXT NOT NULL,
  device TEXT,
  geo TEXT,
  unit_kind TEXT NOT NULL CHECK (unit_kind IN ('slot_day','slot_week','cpm','lead','package_week')),
  brand_safety_tier TEXT NOT NULL DEFAULT 'A',
  backup_required BOOLEAN NOT NULL DEFAULT FALSE,
  max_weight_kb INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msos_capacity_buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id UUID NOT NULL REFERENCES msos_placements(id),
  bucket_date DATE NOT NULL,
  total_qty BIGINT NOT NULL,
  reserved_soft BIGINT NOT NULL DEFAULT 0,
  reserved_hard BIGINT NOT NULL DEFAULT 0,
  delivered_qty BIGINT NOT NULL DEFAULT 0,
  released_qty BIGINT NOT NULL DEFAULT 0,
  UNIQUE (placement_id, bucket_date)
);

CREATE TABLE IF NOT EXISTS msos_rate_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code TEXT NOT NULL UNIQUE,
  owner_kind TEXT NOT NULL CHECK (owner_kind IN ('ptt','partner')),
  partner_id UUID REFERENCES msos_partners(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msos_rate_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_card_id UUID NOT NULL REFERENCES msos_rate_cards(id),
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','published','expired')),
  published_at TIMESTAMPTZ,
  published_by BIGINT,
  unit_price_vnd BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'VND',
  UNIQUE (rate_card_id, version)
);

CREATE TABLE IF NOT EXISTS msos_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL,
  commercial_ref TEXT,
  sell_vnd BIGINT NOT NULL DEFAULT 0,
  hide_buy_side BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT
);

CREATE TABLE IF NOT EXISTS msos_package_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES msos_packages(id),
  placement_id UUID NOT NULL REFERENCES msos_placements(id),
  rate_version_id UUID NOT NULL REFERENCES msos_rate_versions(id),
  qty BIGINT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS msos_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES msos_packages(id),
  placement_id UUID NOT NULL REFERENCES msos_placements(id),
  bucket_date DATE NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('soft','hard','waitlist')),
  qty BIGINT NOT NULL,
  expires_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msos_brand_safety_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT NOT NULL,
  alcohol_pharma_banned BOOLEAN NOT NULL DEFAULT TRUE,
  exclusions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msos_insertion_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code TEXT NOT NULL UNIQUE,
  package_id UUID NOT NULL REFERENCES msos_packages(id),
  media_line_id UUID,
  client_id UUID NOT NULL,
  rate_version_id UUID NOT NULL REFERENCES msos_rate_versions(id),
  safety_snapshot_id UUID NOT NULL REFERENCES msos_brand_safety_snapshots(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  qty BIGINT NOT NULL,
  sell_vnd BIGINT NOT NULL,
  buy_vnd BIGINT NOT NULL,
  partner_confirmed_at TIMESTAMPTZ,
  partner_confirm_ref TEXT,
  issued_at TIMESTAMPTZ,
  issued_by BIGINT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','confirmed','cancelled'))
);

CREATE TABLE IF NOT EXISTS msos_io_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  io_id UUID NOT NULL REFERENCES msos_insertion_orders(id),
  revision INTEGER NOT NULL,
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT,
  UNIQUE (io_id, revision)
);

CREATE TABLE IF NOT EXISTS msos_media_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code TEXT NOT NULL UNIQUE,
  package_id UUID NOT NULL REFERENCES msos_packages(id),
  io_id UUID REFERENCES msos_insertion_orders(id),
  client_id UUID NOT NULL,
  commercial_ref TEXT,
  connector_external_id TEXT,
  tracking_owner_staff_id BIGINT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','ready','live','paused','ended','stale')),
  live_at TIMESTAMPTZ,
  live_by BIGINT,
  p03_override_by BIGINT,
  p03_override_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE msos_insertion_orders
  ADD CONSTRAINT msos_io_media_line_fk
  FOREIGN KEY (media_line_id) REFERENCES msos_media_lines(id);

CREATE TABLE IF NOT EXISTS msos_traffic_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code TEXT NOT NULL UNIQUE,
  media_line_id UUID NOT NULL REFERENCES msos_media_lines(id),
  creative_id UUID,
  width_px INTEGER,
  height_px INTEGER,
  weight_kb INTEGER,
  click_url TEXT,
  backup_attached BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','approved_by_partner','rejected')),
  reject_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msos_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code TEXT NOT NULL UNIQUE,
  media_line_id UUID NOT NULL REFERENCES msos_media_lines(id),
  source TEXT NOT NULL,
  hash TEXT,
  captured_at TIMESTAMPTZ NOT NULL,
  storage_key TEXT,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msos_evidence_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code TEXT NOT NULL UNIQUE,
  media_line_id UUID NOT NULL REFERENCES msos_media_lines(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','official')),
  official_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msos_evidence_pack_items (
  pack_id UUID NOT NULL REFERENCES msos_evidence_packs(id),
  evidence_id UUID NOT NULL REFERENCES msos_evidence(id),
  PRIMARY KEY (pack_id, evidence_id)
);

CREATE TABLE IF NOT EXISTS msos_discrepancy_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code TEXT NOT NULL UNIQUE,
  media_line_id UUID NOT NULL REFERENCES msos_media_lines(id),
  io_qty BIGINT NOT NULL,
  report_qty BIGINT,
  evidence_qty BIGINT,
  tolerance_bps INTEGER NOT NULL DEFAULT 300,
  material BOOLEAN NOT NULL DEFAULT FALSE,
  hypothesis TEXT,
  owner_staff_id BIGINT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','waived','closed')),
  waiver_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msos_make_goods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code TEXT NOT NULL UNIQUE,
  discrepancy_id UUID NOT NULL REFERENCES msos_discrepancy_cases(id),
  media_line_id UUID NOT NULL REFERENCES msos_media_lines(id),
  qty BIGINT NOT NULL,
  value_vnd BIGINT NOT NULL DEFAULT 0,
  capacity_reserved BOOLEAN NOT NULL DEFAULT FALSE,
  closed_at TIMESTAMPTZ,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msos_outcome_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code TEXT NOT NULL UNIQUE,
  media_line_id UUID NOT NULL REFERENCES msos_media_lines(id),
  lead_id UUID,
  sale_id UUID,
  model TEXT,
  match_status TEXT NOT NULL CHECK (match_status IN ('matched','unmatched')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msos_margin_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_line_id UUID NOT NULL REFERENCES msos_media_lines(id),
  gross_sell_vnd BIGINT NOT NULL,
  discount_vnd BIGINT NOT NULL DEFAULT 0,
  media_cost_vnd BIGINT NOT NULL DEFAULT 0,
  make_good_cost_vnd BIGINT NOT NULL DEFAULT 0,
  rebate_accrued_vnd BIGINT NOT NULL DEFAULT 0,
  service_cost_vnd BIGINT NOT NULL DEFAULT 0,
  contribution_vnd BIGINT NOT NULL,
  contribution_bps INTEGER NOT NULL,
  closed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msos_deal_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES msos_partners(id),
  commitment_vnd BIGINT NOT NULL,
  used_vnd BIGINT NOT NULL DEFAULT 0,
  expires_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msos_partner_scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES msos_partners(id),
  delivery_bps INTEGER,
  discrepancy_bps INTEGER,
  safety_incidents INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msos_eligibility (
  partner_id UUID PRIMARY KEY REFERENCES msos_partners(id),
  kyc_pass BOOLEAN NOT NULL DEFAULT FALSE,
  scorecard_pass BOOLEAN NOT NULL DEFAULT FALSE,
  rate_published BOOLEAN NOT NULL DEFAULT FALSE,
  reseller_open BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS msos_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  priority TEXT NOT NULL CHECK (priority IN ('P0','P1','P2')),
  kind TEXT NOT NULL,
  media_line_id UUID,
  placement_id UUID,
  title TEXT NOT NULL,
  evidence_text TEXT NOT NULL,
  open BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msos_finance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_line_id UUID NOT NULL REFERENCES msos_media_lines(id),
  evidence_pack_id UUID REFERENCES msos_evidence_packs(id),
  requested_by BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','accepted','rejected')),
  invoice_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msos_policies (
  key TEXT PRIMARY KEY,
  rule_text TEXT NOT NULL,
  enforcement TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS msos_settings (
  key TEXT PRIMARY KEY,
  value_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS msos_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  staff_id BIGINT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  before_json JSONB,
  after_json JSONB,
  correlation_id TEXT,
  ai_trace_id TEXT
);

INSERT INTO schema_migrations (version, description) VALUES
  ('2026-09-12-msos-w1-win', 'MSOS W1+WIN: media supply & outcome OS schema')
ON CONFLICT (version) DO NOTHING;

INSERT INTO msos_policies (key, rule_text, enforcement) VALUES
  ('margin_floor', 'CM < 24% → director; < 18% block', 'hard_approval'),
  ('io_not_invoice', 'Issue IO không tạo số HĐ', 'hard'),
  ('discrepancy_tolerance', '> 3% qty → material; chặn invoice', 'hard_waiver'),
  ('actual_ne_plan_shortfall', 'GT-P06', 'hard'),
  ('brand_safety_lock', 'Đổi sau IO = revision + duyệt', 'change_control'),
  ('ai_action', 'Cấm issue IO / confirm / Live / make-good close / invoice', 'hard'),
  ('reseller_c', 'Eligibility §4.2', 'flag_hard')
ON CONFLICT (key) DO NOTHING;
