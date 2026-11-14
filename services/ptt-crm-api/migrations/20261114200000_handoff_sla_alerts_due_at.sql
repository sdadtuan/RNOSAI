-- Handoff SLA alerts: remember which due_at each alert was sent for, so a clock that is reset
-- (return / resubmit) alerts again. Additive only: the original unique constraint
-- crm_handoff_sla_alerts_uq (lead_id, clock_key, state) is kept and stays the ON CONFLICT target.
-- Trade-off: one row per (lead, clock, state) holds only the latest due_at; older alert history
-- for the same clock/state is overwritten instead of kept. Mirrors HandoffSlaAlertService.runDdl().
ALTER TABLE crm_handoff_sla_alerts
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01 00:00:00+00';

-- Only for databases that ran an earlier draft of this migration (which dropped the constraint):
-- restore a unique index on (lead_id, clock_key, state), keeping the newest row per key.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_index i
      JOIN pg_class t ON t.oid = i.indrelid
     WHERE t.relname = 'crm_handoff_sla_alerts'
       AND i.indisunique
       AND pg_get_indexdef(i.indexrelid) LIKE '%(lead_id, clock_key, state)'
  ) THEN
    DELETE FROM crm_handoff_sla_alerts a
     USING crm_handoff_sla_alerts b
     WHERE a.lead_id = b.lead_id AND a.clock_key = b.clock_key AND a.state = b.state AND a.id < b.id;
    CREATE UNIQUE INDEX IF NOT EXISTS crm_handoff_sla_alerts_lcs_uq
      ON crm_handoff_sla_alerts (lead_id, clock_key, state);
  END IF;
END $$;
