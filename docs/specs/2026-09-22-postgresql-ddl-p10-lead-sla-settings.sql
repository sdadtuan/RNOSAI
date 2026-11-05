-- PTT-AI-P10 Admin — Lead First Response SLA settings
BEGIN;

CREATE TABLE IF NOT EXISTS crm_lead_sla_settings (
  id                BIGSERIAL PRIMARY KEY,
  tenant_id         TEXT NOT NULL DEFAULT 'default',
  payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
  draft_payload     JSONB,
  settings_version  INT NOT NULL DEFAULT 1,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  published_at      TIMESTAMPTZ,
  updated_by        VARCHAR(160) NOT NULL DEFAULT '',
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT crm_lead_sla_settings_tenant_uq UNIQUE (tenant_id)
);

CREATE TABLE IF NOT EXISTS crm_lead_sla_settings_revisions (
  id                BIGSERIAL PRIMARY KEY,
  settings_id       BIGINT REFERENCES crm_lead_sla_settings(id) ON DELETE SET NULL,
  settings_version  INT NOT NULL,
  payload           JSONB NOT NULL,
  note              TEXT NOT NULL DEFAULT '',
  actor             VARCHAR(160) NOT NULL DEFAULT '',
  action            TEXT NOT NULL DEFAULT 'publish',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_lead_sla_revisions_created
  ON crm_lead_sla_settings_revisions (created_at DESC);

-- Lead FR / hold fields (P10.a foundation; Admin effect: fr1_due_at on new assign)
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

CREATE INDEX IF NOT EXISTS idx_crm_leads_fr1_due
  ON crm_leads (fr1_due_at)
  WHERE fr1_due_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_leads_hold_until
  ON crm_leads (hold_until)
  WHERE hold_until IS NOT NULL;

-- accepts_leads alias: reuse can_receive_leads; default true for active AM/sales-like titles
ALTER TABLE crm_staff
  ADD COLUMN IF NOT EXISTS can_receive_leads BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE crm_staff s
SET can_receive_leads = TRUE
WHERE s.active IS TRUE
  AND s.can_receive_leads IS NOT TRUE
  AND (
    lower(COALESCE(s.job_title, '')) ~ '(am|account|sales|ae|kinh doanh|gdkd)'
    OR EXISTS (
      SELECT 1 FROM crm_b2b_project_staff ps
      WHERE ps.staff_id = s.id AND COALESCE(ps.assign_enabled, TRUE) IS TRUE
    )
  );

-- Seed default tenant settings (§5.4 + dry_run true / reassign false)
INSERT INTO crm_lead_sla_settings
  (tenant_id, payload, draft_payload, settings_version, is_active, published_at, updated_by)
VALUES (
  'default',
  '{
    "schema_version": 1,
    "timezone": "Asia/Saigon",
    "working_hours": {"days":[1,2,3,4,5],"start":"09:00","end":"18:00"},
    "holidays": [],
    "fr1_hours": 2,
    "fr1_channels": ["phone"],
    "case_1a": {
      "meeting_book_max_working_days": 3,
      "escalate_if_no_meeting_after_working_days": 3,
      "post_meeting_update_hours": 4
    },
    "case_1b": {
      "max_working_days": 3,
      "min_attempts": 5,
      "min_gap_working_hours": 2,
      "hot_max_working_days": 2,
      "hot_min_attempts": 4,
      "cooldown_days_same_am": 7,
      "max_extends": 1,
      "extend_working_days": 1
    },
    "case_1c": {
      "wrong_number_max_working_hours": 4,
      "unreachable_max_working_days": 2,
      "unreachable_min_attempts": 3,
      "max_reassign_rounds": 1
    },
    "hot_rules": {
      "sources": ["ads_form", "callback_request"],
      "tags": ["hot", "goi_gap"]
    },
    "redistribute": {
      "strategy": "round_robin_least_open",
      "assign_queue_max_wait_working_hours": 1,
      "max_open_attempting_per_am": 30
    },
    "eligible_pipeline_stages": ["new","moi","qualified","lead_b2b","attempting","da_lien_he"],
    "feature_flags": {
      "lead_sla_reassign_enabled": false,
      "lead_sla_reassign_dry_run": true,
      "reassign_on_1a_timeout": false,
      "allow_hold_recalc": false,
      "min_dry_run_days": 3,
      "dry_run_started_at": null
    },
    "settings_version": 1
  }'::jsonb,
  NULL,
  1,
  TRUE,
  NOW(),
  'seed'
)
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO schema_migrations (version, description)
VALUES (
  '2026-09-22-p10-lead-sla-settings',
  'P10 Admin: crm_lead_sla_settings + revisions + lead FR columns + accepts_leads seed'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
