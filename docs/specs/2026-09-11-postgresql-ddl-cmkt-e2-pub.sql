-- docs/specs/2026-09-11-postgresql-ddl-cmkt-e2-pub.sql
-- Publication execution log for human Mark published (FR-PUB-009/010, Task 27).
CREATE TABLE IF NOT EXISTS cmkt_publication_logs (
    id           BIGSERIAL PRIMARY KEY,
    item_id      BIGINT NOT NULL REFERENCES cmkt_content_items (id) ON DELETE CASCADE,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    error        TEXT,
    retry_n      INT NOT NULL,
    post_id      TEXT,
    http_status  INT,
    CONSTRAINT cmkt_publication_logs_retry_n_check CHECK (retry_n >= 1),
    CONSTRAINT cmkt_publication_logs_item_retry_uq UNIQUE (item_id, retry_n)
);

CREATE UNIQUE INDEX IF NOT EXISTS cmkt_publication_logs_item_retry_uq
    ON cmkt_publication_logs (item_id, retry_n);

CREATE INDEX IF NOT EXISTS idx_cmkt_publication_logs_item_attempted
    ON cmkt_publication_logs (item_id, attempted_at ASC, id ASC);

INSERT INTO schema_migrations (version, description) VALUES
    ('2026-09-11-cmkt-e2-pub', 'CMKT-E2: publication execution log for mark-published attempts')
ON CONFLICT (version) DO NOTHING;
