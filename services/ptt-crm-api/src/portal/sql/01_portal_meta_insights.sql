-- Portal Meta ad insights — daily_performance grain + per-account sync state (idempotent)
-- Applied via ensurePortalMetaInsightsSchema() on startup (local + servers with DDL rights).

BEGIN;

ALTER TABLE daily_performance
    ADD COLUMN IF NOT EXISTS insight_level VARCHAR(16) NOT NULL DEFAULT 'campaign';

ALTER TABLE daily_performance
    ADD COLUMN IF NOT EXISTS external_adset_id VARCHAR(128) NOT NULL DEFAULT '';

ALTER TABLE daily_performance
    ADD COLUMN IF NOT EXISTS external_adset_name VARCHAR(255);

ALTER TABLE daily_performance
    ADD COLUMN IF NOT EXISTS external_ad_id VARCHAR(128) NOT NULL DEFAULT '';

ALTER TABLE daily_performance
    ADD COLUMN IF NOT EXISTS external_ad_name VARCHAR(255);

ALTER TABLE daily_performance
    ADD COLUMN IF NOT EXISTS inline_link_clicks BIGINT;

UPDATE daily_performance
SET insight_level = COALESCE(NULLIF(insight_level, ''), 'campaign'),
    external_adset_id = COALESCE(external_adset_id, ''),
    external_ad_id = COALESCE(external_ad_id, '')
WHERE insight_level IS NULL OR external_adset_id IS NULL OR external_ad_id IS NULL;

ALTER TABLE daily_performance DROP CONSTRAINT IF EXISTS daily_performance_unique;

DROP INDEX IF EXISTS idx_daily_performance_grain_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_performance_grain_unique
    ON daily_performance (
        client_id,
        channel,
        external_campaign_id,
        external_adset_id,
        external_ad_id,
        insight_level,
        performance_date
    );

CREATE INDEX IF NOT EXISTS idx_daily_performance_account_level
    ON daily_performance (client_id, external_account_id, insight_level, performance_date DESC);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'daily_performance_insight_level_check'
    ) THEN
        ALTER TABLE daily_performance
            ADD CONSTRAINT daily_performance_insight_level_check
            CHECK (insight_level IN ('account', 'campaign', 'adset', 'ad'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS meta_ad_account_sync_state (
    client_id               UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
    external_account_id     TEXT NOT NULL,
    last_synced_at          TIMESTAMPTZ,
    last_error              TEXT,
    last_since              DATE,
    last_until              DATE,
    rows_upserted           INT NOT NULL DEFAULT 0,
    last_breakdown_warnings TEXT,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT meta_ad_account_sync_state_unique UNIQUE (client_id, external_account_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_ad_account_sync_client
    ON meta_ad_account_sync_state (client_id, updated_at DESC);

ALTER TABLE meta_ad_account_sync_state
    ADD COLUMN IF NOT EXISTS last_breakdown_warnings TEXT;

CREATE TABLE IF NOT EXISTS daily_performance_breakdown (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id           UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
    channel             VARCHAR(16) NOT NULL DEFAULT 'meta',
    external_campaign_id VARCHAR(128) NOT NULL,
    performance_date    DATE NOT NULL,
    breakdown_type      VARCHAR(32) NOT NULL,
    breakdown_value     VARCHAR(64) NOT NULL,
    spend               NUMERIC(18, 2) NOT NULL DEFAULT 0,
    impressions         BIGINT NOT NULL DEFAULT 0,
    clicks              BIGINT NOT NULL DEFAULT 0,
    leads_platform      INT NOT NULL DEFAULT 0,
    raw_insights        JSONB NOT NULL DEFAULT '{}'::jsonb,
    synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT daily_performance_breakdown_unique
        UNIQUE (client_id, channel, external_campaign_id, performance_date, breakdown_type, breakdown_value)
);

ALTER TABLE daily_performance_breakdown
    ADD COLUMN IF NOT EXISTS external_account_id TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_daily_perf_breakdown_client_date
    ON daily_performance_breakdown (client_id, performance_date DESC);

COMMIT;
