-- docs/specs/2026-09-11-postgresql-ddl-cmkt-e2-delegate.sql
-- Time-boxed delegate stub on approval packages (FR-APR-009, Task 28).
ALTER TABLE cmkt_approval_packages
    ADD COLUMN IF NOT EXISTS delegate_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_cmkt_approval_packages_delegate_until
    ON cmkt_approval_packages (delegate_until)
    WHERE delegate_until IS NOT NULL;

INSERT INTO schema_migrations (version, description) VALUES
    ('2026-09-11-cmkt-e2-delegate', 'CMKT-E2: time-boxed delegate_until on approval packages')
ON CONFLICT (version) DO NOTHING;
