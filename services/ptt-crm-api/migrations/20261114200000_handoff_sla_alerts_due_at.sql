-- Handoff SLA alerts: dedupe per due_at so a clock that is reset (return / resubmit)
-- can alert again. Idempotent; mirrors HandoffSlaAlertService.ensureTable().
ALTER TABLE crm_handoff_sla_alerts
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01 00:00:00+00';

ALTER TABLE crm_handoff_sla_alerts DROP CONSTRAINT IF EXISTS crm_handoff_sla_alerts_uq;

CREATE UNIQUE INDEX IF NOT EXISTS crm_handoff_sla_alerts_due_uq
  ON crm_handoff_sla_alerts (lead_id, clock_key, state, due_at);
