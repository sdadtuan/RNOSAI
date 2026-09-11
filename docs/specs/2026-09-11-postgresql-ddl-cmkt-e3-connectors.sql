-- docs/specs/2026-09-11-postgresql-ddl-cmkt-e3-connectors.sql
-- Channel accounts + connectors + settings persist (FR-SET-003, Task 30).
-- Secret columns are server-only; public SELECT lists must omit token fields.
CREATE TABLE IF NOT EXISTS cmkt_channel_accounts (
    id           BIGSERIAL PRIMARY KEY,
    lifecycle_id BIGINT REFERENCES crm_service_lifecycle (id) ON DELETE CASCADE,
    channel      TEXT NOT NULL,
    account_ref  TEXT NOT NULL DEFAULT '',
    display_name TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cmkt_channel_accounts_lifecycle_channel
    ON cmkt_channel_accounts (lifecycle_id, channel);

CREATE TABLE IF NOT EXISTS cmkt_connectors (
    id                 BIGSERIAL PRIMARY KEY,
    channel_account_id BIGINT REFERENCES cmkt_channel_accounts (id) ON DELETE CASCADE,
    connector_id       TEXT NOT NULL,
    channel            TEXT NOT NULL,
    status             TEXT NOT NULL DEFAULT 'off',
    expires_at         TIMESTAMPTZ,
    access_token       TEXT,
    refresh_token      TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cmkt_connectors_channel
    ON cmkt_connectors (channel);

CREATE TABLE IF NOT EXISTS cmkt_settings (
    key         TEXT PRIMARY KEY,
    value_json  JSONB NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by  VARCHAR(120) NOT NULL DEFAULT ''
);

INSERT INTO schema_migrations (version, description) VALUES
    ('2026-09-11-cmkt-e3-connectors', 'CMKT-E3: channel accounts, connectors, settings persist (direct_social_publish default off)')
ON CONFLICT (version) DO NOTHING;
