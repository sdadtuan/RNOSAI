-- PTT-AI-P10.a — Lead FR SLA call attempts + extended lead columns (§5.1 / §15)
BEGIN;

-- Extend lead columns beyond Admin foundation
ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS first_call_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lead_arrived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS callback_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meeting_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meeting_place TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS info_withheld BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hold_profile TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS previous_assignee_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sla_extend_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contact_closed_reason TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS needs_gdkd_escalate BOOLEAN NOT NULL DEFAULT FALSE;

-- Ensure FR foundation cols exist (idempotent with Admin DDL)
ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS fr1_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fr1_breached BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hold_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hold_reason TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact_status TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS call_attempt_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attempts_since_assign INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_call_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_call_result TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS next_call_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_hot BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reassign_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sla_settings_version INT;

CREATE INDEX IF NOT EXISTS idx_crm_leads_contact_status
  ON crm_leads (contact_status)
  WHERE contact_status <> '';

CREATE INDEX IF NOT EXISTS idx_crm_leads_fr1_breach
  ON crm_leads (fr1_breached, fr1_due_at)
  WHERE fr1_due_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS crm_lead_call_attempts (
  id                  BIGSERIAL PRIMARY KEY,
  lead_id             BIGINT NOT NULL,
  sqlite_lead_id      BIGINT NOT NULL,
  attempt_no          INT NOT NULL DEFAULT 1,
  staff_id            BIGINT,
  channel             TEXT NOT NULL DEFAULT 'phone',
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  call_result         TEXT NOT NULL,
  disposition         TEXT NOT NULL DEFAULT '',
  notes               TEXT NOT NULL DEFAULT '',
  duration_sec        INT,
  counts_toward_sla   BOOLEAN NOT NULL DEFAULT TRUE,
  counts_toward_fr1   BOOLEAN NOT NULL DEFAULT FALSE,
  warn_call_too_soon  BOOLEAN NOT NULL DEFAULT FALSE,
  created_by          VARCHAR(160) NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_lead_call_attempts_lead
  ON crm_lead_call_attempts (sqlite_lead_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_lead_call_attempts_result
  ON crm_lead_call_attempts (call_result);

-- Stub table for P10.b (no job yet)
CREATE TABLE IF NOT EXISTS crm_lead_reassign_events (
  id                    BIGSERIAL PRIMARY KEY,
  sqlite_lead_id        BIGINT NOT NULL,
  from_staff_id         BIGINT,
  to_staff_id           BIGINT,
  reason                TEXT NOT NULL DEFAULT '',
  hold_until_snapshot   TIMESTAMPTZ,
  attempt_count_snapshot INT NOT NULL DEFAULT 0,
  job_run_id            TEXT NOT NULL DEFAULT '',
  dry_run               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version, description)
VALUES (
  '2026-09-22-p10a-lead-fr-sla',
  'P10.a: call attempts + extended FR/hold columns on crm_leads'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
