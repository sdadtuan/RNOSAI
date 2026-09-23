-- P11.a strategy packs + marketing plan growth_sections
BEGIN;

CREATE TABLE IF NOT EXISTS strategy_industry_packs (
  id                    BIGSERIAL PRIMARY KEY,
  key                   VARCHAR(64) NOT NULL UNIQUE,
  name_vi               TEXT NOT NULL DEFAULT '',
  journey_focus         TEXT NOT NULL DEFAULT '',
  marketing_priorities  TEXT NOT NULL DEFAULT '',
  defaults_json         JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  version               INT NOT NULL DEFAULT 1,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS strategy_service_packs (
  id            BIGSERIAL PRIMARY KEY,
  key           VARCHAR(64) NOT NULL UNIQUE,
  name_vi       TEXT NOT NULL DEFAULT '',
  defaults_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  version       INT NOT NULL DEFAULT 1,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE crm_marketing_plans
  ADD COLUMN IF NOT EXISTS growth_sections JSONB,
  ADD COLUMN IF NOT EXISTS industry_pack_key VARCHAR(64),
  ADD COLUMN IF NOT EXISTS service_pack_key VARCHAR(64);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'service_deliveries'
  ) THEN
    ALTER TABLE service_deliveries
      ADD COLUMN IF NOT EXISTS industry_pack_key VARCHAR(64),
      ADD COLUMN IF NOT EXISTS service_pack_key VARCHAR(64);
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'crm_service_lifecycle'
  ) THEN
    ALTER TABLE crm_service_lifecycle
      ADD COLUMN IF NOT EXISTS industry_pack_key VARCHAR(64),
      ADD COLUMN IF NOT EXISTS service_pack_key VARCHAR(64);
  END IF;
END $$;

COMMIT;
