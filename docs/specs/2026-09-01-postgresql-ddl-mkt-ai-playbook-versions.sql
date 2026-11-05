BEGIN;
CREATE TABLE IF NOT EXISTS mkt_ai_playbook_versions (
    id              BIGSERIAL PRIMARY KEY,
    service_slug    TEXT NOT NULL,
    version_no      INT NOT NULL,
    status          TEXT NOT NULL CHECK (status IN (
                      'draft', 'pending_review', 'approved', 'active', 'retired', 'rejected_auto')),
    depth           TEXT NOT NULL CHECK (depth IN ('shipped', 'shallow', 'deep')),
    document_json   JSONB NOT NULL,
    source          TEXT NOT NULL CHECK (source IN ('disk', 'common', 'learn', 'manual')),
    learn_job_id    BIGINT,
    corpus_json     JSONB NOT NULL DEFAULT '{}',
    created_by      TEXT NOT NULL DEFAULT '',
    reviewed_by     TEXT,
    reviewed_at     TIMESTAMPTZ,
    review_note     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (service_slug, version_no)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mkt_ai_playbook_one_active
    ON mkt_ai_playbook_versions (service_slug) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS mkt_ai_playbook_learn_jobs (
    id                  BIGSERIAL PRIMARY KEY,
    service_slug        TEXT NOT NULL,
    status              TEXT NOT NULL CHECK (status IN (
                          'queued', 'running', 'succeeded', 'failed')),
    actor               TEXT NOT NULL,
    error               TEXT,
    output_version_id   BIGINT REFERENCES mkt_ai_playbook_versions (id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_mkt_ai_playbook_learn_slug
    ON mkt_ai_playbook_learn_jobs (service_slug, created_at DESC);

ALTER TABLE mkt_ai_service_policy
    ADD CONSTRAINT mkt_ai_service_policy_active_fk
    FOREIGN KEY (active_version_id) REFERENCES mkt_ai_playbook_versions (id)
    DEFERRABLE INITIALLY DEFERRED;
COMMIT;
