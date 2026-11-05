-- docs/specs/2026-09-11-postgresql-ddl-cmkt-e3-glossary.sql
-- Brand glossary / localization memory (FR-COPY-012, FR-AI-002, Task 34).
-- Do not rewrite E0 2026-09-10-postgresql-ddl-cmkt-e.sql.
CREATE TABLE IF NOT EXISTS cmkt_glossary (
    id              BIGSERIAL PRIMARY KEY,
    brand_id        TEXT NOT NULL,
    term            TEXT NOT NULL,
    locale          TEXT NOT NULL DEFAULT 'vi',
    preferred       TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'Draft',
    expires_at      TIMESTAMPTZ,
    lifecycle_id    BIGINT REFERENCES crm_service_lifecycle (id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT cmkt_glossary_status_check CHECK (
        status IN ('Draft', 'Approved', 'Rejected')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cmkt_glossary_term_locale_brand
    ON cmkt_glossary (term, locale, brand_id);

CREATE INDEX IF NOT EXISTS idx_cmkt_glossary_brand_locale
    ON cmkt_glossary (brand_id, locale);

CREATE INDEX IF NOT EXISTS idx_cmkt_glossary_lifecycle_status
    ON cmkt_glossary (lifecycle_id, status);

INSERT INTO schema_migrations (version, description) VALUES
    ('2026-09-11-cmkt-e3-glossary', 'CMKT-E3: brand glossary localization memory')
ON CONFLICT (version) DO NOTHING;
