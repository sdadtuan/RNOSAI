BEGIN;
CREATE TABLE IF NOT EXISTS mkt_ai_service_policy (
    service_slug          TEXT PRIMARY KEY,
    rollout               TEXT NOT NULL DEFAULT 'off'
                          CHECK (rollout IN ('off', 'pilot', 'ga')),
    enabled               BOOLEAN NOT NULL DEFAULT TRUE,
    active_version_id     BIGINT,
    strict_pilot_quality  BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by            TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_mkt_ai_service_policy_rollout
    ON mkt_ai_service_policy (rollout) WHERE enabled;
COMMIT;
