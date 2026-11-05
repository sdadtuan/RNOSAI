-- docs/specs/2026-09-11-postgresql-ddl-cmkt-e4-win.sql
-- E4 WIN: oauth CSRF, idempotent execute, DAM bind, legal hold actor.
-- Do not rewrite E0/E3 DDL. Do not SELECT token columns here.
CREATE TABLE IF NOT EXISTS cmkt_oauth_states (
    state        TEXT PRIMARY KEY,
    staff_id     BIGINT NOT NULL,
    lifecycle_id BIGINT NOT NULL,
    expires_at   TIMESTAMPTZ NOT NULL,
    used_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cmkt_oauth_states_expires
    ON cmkt_oauth_states (expires_at);

CREATE TABLE IF NOT EXISTS cmkt_publication_executes (
    id                  BIGSERIAL PRIMARY KEY,
    item_id             BIGINT NOT NULL,
    channel_account_id  BIGINT NOT NULL,
    snapshot_id         TEXT NOT NULL,
    client_request_id   TEXT,
    post_id             TEXT,
    permalink           TEXT,
    status              TEXT NOT NULL DEFAULT 'queued',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (item_id, channel_account_id, snapshot_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS cmkt_publication_executes_client_req
    ON cmkt_publication_executes (client_request_id)
    WHERE client_request_id IS NOT NULL AND client_request_id <> '';

CREATE TABLE IF NOT EXISTS cmkt_dam_bindings (
    id          BIGSERIAL PRIMARY KEY,
    item_id     BIGINT NOT NULL,
    dam_id      TEXT NOT NULL,
    url         TEXT NOT NULL,
    rights_json JSONB,
    bound_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cmkt_dam_bindings_item
    ON cmkt_dam_bindings (item_id, bound_at DESC);

ALTER TABLE cmkt_content_items
    ADD COLUMN IF NOT EXISTS legal_hold_set_by VARCHAR(120);

INSERT INTO schema_migrations (version, description) VALUES
    ('2026-09-11-cmkt-e4-win', 'CMKT-E4: oauth state, execute unique, dam bind, legal_hold_set_by')
ON CONFLICT (version) DO NOTHING;
