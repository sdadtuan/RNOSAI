-- docs/specs/2026-09-11-postgresql-ddl-cmkt-e2-sla.sql
-- Queryable SLA reminder / at-risk / breach audit (FR-AUD-006, Task 24).
CREATE TABLE IF NOT EXISTS cmkt_sla_events (
    id           BIGSERIAL PRIMARY KEY,
    item_id      BIGINT NOT NULL REFERENCES cmkt_content_items (id) ON DELETE CASCADE,
    task_id      TEXT NOT NULL,
    threshold    INT NOT NULL,
    action       TEXT NOT NULL,
    am_staff_id  INT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT cmkt_sla_events_action_check CHECK (
        action IN ('reminder', 'at_risk', 'breached')
    ),
    CONSTRAINT cmkt_sla_events_item_task_threshold_uq UNIQUE (item_id, task_id, threshold)
);

CREATE UNIQUE INDEX IF NOT EXISTS cmkt_sla_events_item_task_threshold_uq
    ON cmkt_sla_events (item_id, task_id, threshold);

CREATE INDEX IF NOT EXISTS idx_cmkt_sla_events_item_created
    ON cmkt_sla_events (item_id, created_at ASC, id ASC);

INSERT INTO schema_migrations (version, description) VALUES
    ('2026-09-11-cmkt-e2-sla', 'CMKT-E2: queryable production SLA reminder/at-risk/breach events')
ON CONFLICT (version) DO NOTHING;
