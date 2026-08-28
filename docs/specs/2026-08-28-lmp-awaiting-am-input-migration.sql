-- Phase 0 — allow awaiting_am_input status on crm_lead_meeting_prep
ALTER TABLE crm_lead_meeting_prep
  DROP CONSTRAINT IF EXISTS crm_lead_meeting_prep_status_check;

ALTER TABLE crm_lead_meeting_prep
  ADD CONSTRAINT crm_lead_meeting_prep_status_check
  CHECK (status IN (
    'pending',
    'running',
    'awaiting_entity_choice',
    'awaiting_am_input',
    'ready',
    'failed',
    'skipped',
    'cancelled'
  ));

COMMENT ON COLUMN crm_lead_meeting_prep.status IS
  'Prep lifecycle — awaiting_am_input = lead has contact but company name missing after tier-1 hints.';
