-- Portal care assignment: held (manual unassign) and pinned manual assigns.
-- Additive and idempotent. Apply via ensurePortalCrmLocalSchema() or locally:
--   psql "$DATABASE_URL" -f services/ptt-crm-api/src/portal/sql/05_portal_care_assignment.sql
-- Review only — do not run against production database hosts.

ALTER TABLE portal_care_cases ADD COLUMN IF NOT EXISTS held BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE portal_care_cases ADD COLUMN IF NOT EXISTS assigned_manually BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN portal_care_cases.held IS 'Manager deliberately unassigned; rebalance must not auto-assign.';
COMMENT ON COLUMN portal_care_cases.assigned_manually IS 'Pinned manual assignment; skip 15m/24h hop unless assignee is inactive.';

CREATE INDEX IF NOT EXISTS portal_care_cases_rebalance_idx
  ON portal_care_cases (client_id, status, held)
  WHERE status <> 'purchased';
