-- Additive handoff SLA clocks (7-step policy, 14/11/2026).
ALTER TABLE crm_lead_presales
  ADD COLUMN IF NOT EXISTS brief_entered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS brief_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS negotiate_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contract_due_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS crm_handoff_sla_alerts (
  id          BIGSERIAL PRIMARY KEY,
  lead_id     BIGINT NOT NULL,
  clock_key   TEXT NOT NULL,
  state       TEXT NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT crm_handoff_sla_alerts_uq UNIQUE (lead_id, clock_key, state)
);

CREATE INDEX IF NOT EXISTS idx_crm_handoff_sla_alerts_sent
  ON crm_handoff_sla_alerts (sent_at DESC);
