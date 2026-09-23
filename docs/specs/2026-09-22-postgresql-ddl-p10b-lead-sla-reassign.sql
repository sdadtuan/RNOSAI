-- P10.b — reassign events columns + job run locks
BEGIN;

ALTER TABLE crm_lead_reassign_events
  ADD COLUMN IF NOT EXISTS would_to_staff_id BIGINT,
  ADD COLUMN IF NOT EXISTS decision TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_lead_reassign_job_lead
  ON crm_lead_reassign_events (job_run_id, sqlite_lead_id)
  WHERE job_run_id <> '';

CREATE TABLE IF NOT EXISTS crm_lead_sla_job_runs (
  job_run_id   TEXT PRIMARY KEY,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at  TIMESTAMPTZ,
  mode         TEXT NOT NULL DEFAULT 'dry_run',
  scanned      INT NOT NULL DEFAULT 0,
  would_reassign INT NOT NULL DEFAULT 0,
  reassigned   INT NOT NULL DEFAULT 0,
  escalated    INT NOT NULL DEFAULT 0,
  nudged       INT NOT NULL DEFAULT 0,
  queue_alerts INT NOT NULL DEFAULT 0,
  skipped      INT NOT NULL DEFAULT 0,
  detail_json  JSONB NOT NULL DEFAULT '{}'::jsonb
);

INSERT INTO schema_migrations (version, description)
VALUES (
  '2026-09-22-p10b-sla-reassign',
  'P10.b: reassign event extras + job run ledger'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
