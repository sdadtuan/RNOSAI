CREATE TABLE IF NOT EXISTS crm_brand_heroes (
  id text PRIMARY KEY,
  filename text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_brand_settings (
  id smallint PRIMARY KEY CHECK (id = 1),
  logo_asset_id text NOT NULL,
  active_hero_id text NOT NULL REFERENCES crm_brand_heroes(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
