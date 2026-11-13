-- Additive, idempotent Portal POS schema (Pancake-style products, orders, shipping).
-- Apply only to the local Postgres. Safe to re-run.

-- Categories (per client)
CREATE TABLE IF NOT EXISTS portal_pos_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  name TEXT NOT NULL,
  parent_id UUID,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, name)
);
CREATE INDEX IF NOT EXISTS portal_pos_categories_client_idx ON portal_pos_categories (client_id);

-- Extend the existing page-product catalog rather than duplicating it.
ALTER TABLE portal_page_products ADD COLUMN IF NOT EXISTS sku TEXT NOT NULL DEFAULT '';
ALTER TABLE portal_page_products ADD COLUMN IF NOT EXISTS barcode TEXT NOT NULL DEFAULT '';
ALTER TABLE portal_page_products ADD COLUMN IF NOT EXISTS category_id UUID;
ALTER TABLE portal_page_products ADD COLUMN IF NOT EXISTS compare_at_vnd BIGINT;
ALTER TABLE portal_page_products ADD COLUMN IF NOT EXISTS cost_vnd BIGINT;
ALTER TABLE portal_page_products ADD COLUMN IF NOT EXISTS weight_gram INT;
ALTER TABLE portal_page_products ADD COLUMN IF NOT EXISTS is_combo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE portal_page_products ADD COLUMN IF NOT EXISTS low_stock_threshold INT NOT NULL DEFAULT 5;

CREATE INDEX IF NOT EXISTS portal_page_products_client_sku_idx ON portal_page_products (client_id, sku);
CREATE INDEX IF NOT EXISTS portal_page_products_client_barcode_idx ON portal_page_products (client_id, barcode);

-- Variants (color, size, extra attrs)
CREATE TABLE IF NOT EXISTS portal_pos_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES portal_page_products (id) ON DELETE CASCADE,
  sku TEXT NOT NULL DEFAULT '',
  barcode TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  size TEXT NOT NULL DEFAULT '',
  attrs JSONB NOT NULL DEFAULT '{}'::jsonb,
  price_vnd BIGINT,
  compare_at_vnd BIGINT,
  cost_vnd BIGINT,
  weight_gram INT,
  image_url TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS portal_pos_variants_uniq
  ON portal_pos_variants (client_id, product_id, color, size);
CREATE INDEX IF NOT EXISTS portal_pos_variants_product_idx ON portal_pos_variants (product_id);
CREATE INDEX IF NOT EXISTS portal_pos_variants_sku_idx ON portal_pos_variants (client_id, sku);

-- Optional combos: a product flagged is_combo contains these items
CREATE TABLE IF NOT EXISTS portal_pos_combo_items (
  combo_product_id UUID NOT NULL REFERENCES portal_page_products (id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES portal_pos_variants (id) ON DELETE RESTRICT,
  quantity INT NOT NULL DEFAULT 1,
  PRIMARY KEY (combo_product_id, variant_id)
);

-- Warehouses: one default per client now; schema is ready for multi-warehouse later
CREATE TABLE IF NOT EXISTS portal_pos_warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Kho mặc định',
  is_default BOOLEAN NOT NULL DEFAULT TRUE,
  address TEXT NOT NULL DEFAULT '',
  low_stock_threshold INT NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS portal_pos_warehouses_one_default
  ON portal_pos_warehouses (client_id) WHERE is_default;
CREATE INDEX IF NOT EXISTS portal_pos_warehouses_client_idx ON portal_pos_warehouses (client_id);

CREATE TABLE IF NOT EXISTS portal_pos_stock (
  warehouse_id UUID NOT NULL REFERENCES portal_pos_warehouses (id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES portal_pos_variants (id) ON DELETE CASCADE,
  on_hand INT NOT NULL DEFAULT 0,
  reserved INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (warehouse_id, variant_id)
);

CREATE TABLE IF NOT EXISTS portal_pos_stock_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES portal_pos_warehouses (id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES portal_pos_variants (id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  qty INT NOT NULL,
  on_hand_after INT NOT NULL,
  reserved_after INT NOT NULL,
  ref_type TEXT NOT NULL DEFAULT '',
  ref_id TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  actor_email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS portal_pos_stock_ledger_variant_idx
  ON portal_pos_stock_ledger (client_id, variant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS portal_pos_stock_ledger_ref_idx
  ON portal_pos_stock_ledger (ref_type, ref_id);

-- Phone-keyed customer profile per client (aggregates orders / conversations / leads)
CREATE TABLE IF NOT EXISTS portal_pos_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  phone TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  province TEXT NOT NULL DEFAULT '',
  district TEXT NOT NULL DEFAULT '',
  ward TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  blacklist BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, phone)
);
CREATE INDEX IF NOT EXISTS portal_pos_customers_client_idx ON portal_pos_customers (client_id);

-- Retail orders — separate from agency crm_orders
CREATE TABLE IF NOT EXISTS portal_pos_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  page_id TEXT NOT NULL DEFAULT '',
  case_id UUID,
  comment_id TEXT NOT NULL DEFAULT '',
  customer_id UUID REFERENCES portal_pos_customers (id) ON DELETE SET NULL,
  assignee_user_id TEXT,
  assignee_email TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  customer_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  province TEXT NOT NULL DEFAULT '',
  district TEXT NOT NULL DEFAULT '',
  ward TEXT NOT NULL DEFAULT '',
  subtotal_vnd BIGINT NOT NULL DEFAULT 0,
  discount_vnd BIGINT NOT NULL DEFAULT 0,
  shipping_fee_vnd BIGINT NOT NULL DEFAULT 0,
  deposit_vnd BIGINT NOT NULL DEFAULT 0,
  total_vnd BIGINT NOT NULL DEFAULT 0,
  cod_vnd BIGINT NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  customer_notes TEXT NOT NULL DEFAULT '',
  ad_id TEXT NOT NULL DEFAULT '',
  post_id TEXT NOT NULL DEFAULT '',
  warehouse_id UUID,
  stock_state TEXT NOT NULL DEFAULT 'none',
  confirmed_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, code)
);
CREATE INDEX IF NOT EXISTS portal_pos_orders_client_status_idx ON portal_pos_orders (client_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS portal_pos_orders_client_phone_idx ON portal_pos_orders (client_id, phone);
CREATE INDEX IF NOT EXISTS portal_pos_orders_case_idx ON portal_pos_orders (case_id);
CREATE INDEX IF NOT EXISTS portal_pos_orders_page_idx ON portal_pos_orders (client_id, page_id);
CREATE INDEX IF NOT EXISTS portal_pos_orders_assignee_idx ON portal_pos_orders (client_id, assignee_user_id);
CREATE INDEX IF NOT EXISTS portal_pos_orders_source_idx ON portal_pos_orders (client_id, source);

CREATE TABLE IF NOT EXISTS portal_pos_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES portal_pos_orders (id) ON DELETE CASCADE,
  product_id UUID,
  variant_id UUID,
  name TEXT NOT NULL DEFAULT '',
  sku TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  size TEXT NOT NULL DEFAULT '',
  qty INT NOT NULL DEFAULT 1,
  price_vnd BIGINT NOT NULL DEFAULT 0,
  cost_vnd BIGINT NOT NULL DEFAULT 0,
  image_url TEXT NOT NULL DEFAULT '',
  weight_gram INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS portal_pos_order_items_order_idx ON portal_pos_order_items (order_id);

CREATE TABLE IF NOT EXISTS portal_pos_order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES portal_pos_orders (id) ON DELETE CASCADE,
  from_status TEXT NOT NULL DEFAULT '',
  to_status TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  actor_email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS portal_pos_order_events_order_idx
  ON portal_pos_order_events (order_id, created_at);

-- Carrier accounts: tokens stored as AES-256-GCM BYTEA (same vault as Meta tokens). Never log.
CREATE TABLE IF NOT EXISTS portal_pos_carrier_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  carrier TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  token_encrypted BYTEA,
  shop_id TEXT NOT NULL DEFAULT '',
  extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  test_mode BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS portal_pos_carrier_accounts_client_idx
  ON portal_pos_carrier_accounts (client_id, carrier);

CREATE TABLE IF NOT EXISTS portal_pos_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES portal_pos_orders (id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  account_id UUID REFERENCES portal_pos_carrier_accounts (id) ON DELETE SET NULL,
  carrier TEXT NOT NULL,
  service_code TEXT NOT NULL DEFAULT '',
  service_name TEXT NOT NULL DEFAULT '',
  tracking_code TEXT NOT NULL DEFAULT '',
  fee_vnd BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'created',
  raw_status TEXT NOT NULL DEFAULT '',
  label_url TEXT NOT NULL DEFAULT '',
  test_mode BOOLEAN NOT NULL DEFAULT TRUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS portal_pos_shipments_order_idx ON portal_pos_shipments (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS portal_pos_shipments_tracking_idx ON portal_pos_shipments (tracking_code);
CREATE INDEX IF NOT EXISTS portal_pos_shipments_client_idx ON portal_pos_shipments (client_id, carrier);

-- COD reconciliation
CREATE TABLE IF NOT EXISTS portal_pos_cod_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  carrier TEXT NOT NULL DEFAULT '',
  period TEXT NOT NULL DEFAULT '',
  filename TEXT NOT NULL DEFAULT '',
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_email TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS portal_pos_cod_statements_client_idx
  ON portal_pos_cod_statements (client_id, imported_at DESC);

CREATE TABLE IF NOT EXISTS portal_pos_cod_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id UUID NOT NULL REFERENCES portal_pos_cod_statements (id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  tracking_code TEXT NOT NULL DEFAULT '',
  order_id UUID,
  order_code TEXT NOT NULL DEFAULT '',
  expected_cod BIGINT NOT NULL DEFAULT 0,
  actual_cod BIGINT NOT NULL DEFAULT 0,
  fee_vnd BIGINT NOT NULL DEFAULT 0,
  payout_vnd BIGINT NOT NULL DEFAULT 0,
  difference_vnd BIGINT NOT NULL DEFAULT 0,
  match_status TEXT NOT NULL DEFAULT 'missing'
);
CREATE INDEX IF NOT EXISTS portal_pos_cod_lines_statement_idx ON portal_pos_cod_lines (statement_id);
CREATE INDEX IF NOT EXISTS portal_pos_cod_lines_tracking_idx ON portal_pos_cod_lines (client_id, tracking_code);

-- Sequence for human-readable order codes per client (DH-000001)
CREATE TABLE IF NOT EXISTS portal_pos_code_seq (
  client_id UUID PRIMARY KEY,
  last_value BIGINT NOT NULL DEFAULT 0
);
