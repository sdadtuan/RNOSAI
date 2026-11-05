-- docs/specs/2026-09-10-postgresql-ddl-cmkt-e.sql
CREATE TABLE IF NOT EXISTS cmkt_content_requests (
    id              BIGSERIAL PRIMARY KEY,
    lifecycle_id    BIGINT NOT NULL REFERENCES crm_service_lifecycle (id) ON DELETE CASCADE,
    display_code    TEXT NOT NULL UNIQUE,
    source          TEXT NOT NULL,
    requester_email TEXT NOT NULL DEFAULT '',
    client_label    TEXT NOT NULL DEFAULT '',
    brand_label     TEXT NOT NULL DEFAULT '',
    deliverable_ask TEXT NOT NULL DEFAULT '',
    objective       TEXT NOT NULL DEFAULT '',
    due_at          TIMESTAMPTZ,
    priority        TEXT NOT NULL DEFAULT 'Standard',
    risk_level      TEXT NOT NULL DEFAULT 'Normal',
    completeness    INT NOT NULL DEFAULT 0,
    effort_h        NUMERIC,
    tier            TEXT,
    triage_status   TEXT NOT NULL DEFAULT 'Submitted',
    idea_id         BIGINT REFERENCES cmkt_content_ideas (id) ON DELETE SET NULL,
    created_by      VARCHAR(120) NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT cmkt_content_requests_source_check CHECK (
        source IN ('account', 'client_portal', 'campaign', 'api', 'idea')
    ),
    CONSTRAINT cmkt_content_requests_status_check CHECK (
        triage_status IN (
            'Submitted', 'Needs Clarification', 'Triaged', 'Accepted',
            'Converted', 'Cancelled', 'Rejected'
        )
    )
);

ALTER TABLE cmkt_content_items
    ADD COLUMN IF NOT EXISTS display_code TEXT,
    ADD COLUMN IF NOT EXISTS request_id BIGINT REFERENCES cmkt_content_requests (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS master_id BIGINT REFERENCES cmkt_content_items (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS risk_level TEXT NOT NULL DEFAULT 'Normal',
    ADD COLUMN IF NOT EXISTS brief_score INT,
    ADD COLUMN IF NOT EXISTS brief_locked_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cmkt_items_display_code
    ON cmkt_content_items (display_code) WHERE display_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS cmkt_asset_rights (
    id              BIGSERIAL PRIMARY KEY,
    item_id         BIGINT NOT NULL REFERENCES cmkt_content_items (id) ON DELETE CASCADE,
    asset_ref       TEXT NOT NULL,
    license_type    TEXT,
    channels        TEXT[] NOT NULL DEFAULT '{}',
    territory       TEXT,
    expiry_at       TIMESTAMPTZ,
    paid_ok         BOOLEAN NOT NULL DEFAULT FALSE,
    releases_ok     BOOLEAN NOT NULL DEFAULT FALSE,
    ai_declaration  BOOLEAN NOT NULL DEFAULT FALSE,
    status          TEXT NOT NULL DEFAULT 'Unknown',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT cmkt_asset_rights_status_check CHECK (status IN ('Valid', 'Invalid', 'Unknown', 'Expiring'))
);

CREATE TABLE IF NOT EXISTS cmkt_approval_packages (
    id              BIGSERIAL PRIMARY KEY,
    item_id         BIGINT NOT NULL REFERENCES cmkt_content_items (id) ON DELETE CASCADE,
    snapshot_json   JSONB NOT NULL,
    status          TEXT NOT NULL DEFAULT 'Draft',
    created_by      VARCHAR(120) NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cmkt_insights (
    id              BIGSERIAL PRIMARY KEY,
    lifecycle_id    BIGINT REFERENCES crm_service_lifecycle (id) ON DELETE CASCADE,
    pattern         TEXT NOT NULL,
    evidence        TEXT NOT NULL DEFAULT '',
    confidence      NUMERIC,
    status          TEXT NOT NULL DEFAULT 'Draft',
    scope_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT cmkt_insights_status_check CHECK (
        status IN ('Draft', 'Approved', 'Rejected', 'Outdated', 'Superseded')
    )
);

INSERT INTO schema_migrations (version, description) VALUES
    ('2026-09-10-cmkt-e', 'CMKT-E: requests, item display_code/master/rights, packages, insights')
ON CONFLICT (version) DO NOTHING;
