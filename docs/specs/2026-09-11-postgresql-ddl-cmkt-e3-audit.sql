-- docs/specs/2026-09-11-postgresql-ddl-cmkt-e3-audit.sql
-- Legal hold on content items + append-only audit export log (FR-AUD-004, Task 33).
-- Do not rewrite E0 2026-09-10-postgresql-ddl-cmkt-e.sql.
ALTER TABLE cmkt_content_items
    ADD COLUMN IF NOT EXISTS legal_hold BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS cmkt_audit_exports (
    id          BIGSERIAL PRIMARY KEY,
    actor       TEXT NOT NULL,
    action      TEXT NOT NULL DEFAULT 'audit_export',
    entity      TEXT NOT NULL DEFAULT 'portfolio_audit',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cmkt_audit_exports_created
    ON cmkt_audit_exports (created_at ASC, id ASC);

INSERT INTO schema_migrations (version, description) VALUES
    ('2026-09-11-cmkt-e3-audit', 'CMKT-E3: legal_hold on items + append-only audit export log')
ON CONFLICT (version) DO NOTHING;
