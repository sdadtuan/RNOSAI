-- WS4: lifecycle milestone timestamps (idempotent)
CREATE TABLE IF NOT EXISTS crm_lifecycle_milestones (
  id BIGSERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL,
  milestone_key VARCHAR(32) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  source VARCHAR(40) NOT NULL,
  ref_id TEXT NOT NULL DEFAULT '',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lead_id, milestone_key)
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_milestones_key_at
  ON crm_lifecycle_milestones (milestone_key, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_lifecycle_milestones_lead
  ON crm_lifecycle_milestones (lead_id);
