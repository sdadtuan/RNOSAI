-- VN administrative divisions (2-level: province/city + ward/commune, post-2025).
-- Source: open-admin-data/vietnam-administrative-divisions (CC-BY-4.0).

CREATE TABLE IF NOT EXISTS vn_provinces (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  source TEXT NOT NULL DEFAULT 'seed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vn_wards (
  code TEXT PRIMARY KEY,
  province_code TEXT NOT NULL REFERENCES vn_provinces (code) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  source TEXT NOT NULL DEFAULT 'seed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vn_provinces_active_sort ON vn_provinces (active, sort_order, name);
CREATE INDEX IF NOT EXISTS idx_vn_wards_province ON vn_wards (province_code, active, sort_order, name);

COMMENT ON TABLE vn_provinces IS 'Tỉnh/Thành phố VN (cấp 2025, không quận/huyện)';
COMMENT ON TABLE vn_wards IS 'Phường/Xã VN — thuộc một Tỉnh/TP';
