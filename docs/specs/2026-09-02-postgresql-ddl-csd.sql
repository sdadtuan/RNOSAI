-- Agency PTT Communication & Service Desk (CSD-20260902)
-- Apply: ./scripts/apply_pg_ddl_csd.sh
-- Isolation: DO NOT touch crm_tickets / crm_ticket_messages / ceo_command_*
-- Tenant MVP: single org PTT. staff ids = INTEGER crm_staff / JWT staffId (not staff_users UUID).

CREATE TABLE IF NOT EXISTS csd_tenants (
  id VARCHAR(32) PRIMARY KEY,
  name_vi VARCHAR(191) NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO csd_tenants (id, name_vi)
VALUES ('PTT', 'Agency PTT')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- SLA
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS csd_business_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES csd_tenants (id),
  holiday_date DATE NOT NULL,
  name_vi VARCHAR(191) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, holiday_date)
);

CREATE TABLE IF NOT EXISTS csd_sla_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES csd_tenants (id),
  code VARCHAR(64) NOT NULL,
  name_vi VARCHAR(191) NOT NULL,
  workday_start TIME NOT NULL DEFAULT '08:30',
  workday_end TIME NOT NULL DEFAULT '18:00',
  workdays SMALLINT[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5, 6],
  pause_on_waiting_client BOOLEAN NOT NULL DEFAULT TRUE,
  pause_on_internal_approval BOOLEAN NOT NULL DEFAULT FALSE,
  auto_close_days INTEGER NOT NULL DEFAULT 7,
  at_risk_pct INTEGER NOT NULL DEFAULT 70,
  near_breach_pct INTEGER NOT NULL DEFAULT 90,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_staff_id INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by_staff_id INTEGER,
  deleted_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS csd_sla_policy_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES csd_sla_policies (id) ON DELETE CASCADE,
  priority VARCHAR(8) NOT NULL,
  response_minutes INTEGER NOT NULL,
  resolution_minutes INTEGER NOT NULL,
  UNIQUE (policy_id, priority),
  CONSTRAINT csd_sla_policy_targets_priority_chk
    CHECK (priority IN ('P1', 'P2', 'P3', 'P4'))
);

CREATE TABLE IF NOT EXISTS csd_sla_policy_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES csd_tenants (id),
  policy_id UUID NOT NULL REFERENCES csd_sla_policies (id) ON DELETE CASCADE,
  client_account_id VARCHAR(64),
  service_package VARCHAR(64),
  ticket_type VARCHAR(64),
  priority VARCHAR(8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS csd_sla_policy_maps_lookup_idx
  ON csd_sla_policy_maps (tenant_id, client_account_id, ticket_type, priority);

INSERT INTO csd_sla_policies (tenant_id, code, name_vi, is_default)
VALUES ('PTT', 'PTT-DEFAULT', 'SLA mặc định Agency PTT', TRUE)
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO csd_sla_policy_targets (policy_id, priority, response_minutes, resolution_minutes)
SELECT p.id, t.priority, t.response_minutes, t.resolution_minutes
FROM csd_sla_policies p
CROSS JOIN (VALUES
  ('P1', 60, 240),
  ('P2', 240, 480),
  ('P3', 480, 1440),
  ('P4', 960, 2400)
) AS t(priority, response_minutes, resolution_minutes)
WHERE p.tenant_id = 'PTT' AND p.code = 'PTT-DEFAULT'
ON CONFLICT (policy_id, priority) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Files / audit / notifications / AI (shared)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS csd_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES csd_tenants (id),
  storage_key VARCHAR(512) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(128) NOT NULL,
  byte_size INTEGER NOT NULL,
  visibility VARCHAR(16) NOT NULL DEFAULT 'internal',
  entity_type VARCHAR(32) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  uploaded_by_staff_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT csd_attachments_vis_chk CHECK (visibility IN ('internal', 'client', 'restricted')),
  CONSTRAINT csd_attachments_size_chk CHECK (byte_size > 0 AND byte_size <= 104857600)
);
CREATE INDEX IF NOT EXISTS csd_attachments_entity_idx
  ON csd_attachments (tenant_id, entity_type, entity_id)
  WHERE is_deleted = FALSE;

CREATE TABLE IF NOT EXISTS csd_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES csd_tenants (id),
  actor_type VARCHAR(16) NOT NULL,
  actor_staff_id INTEGER,
  action VARCHAR(64) NOT NULL,
  entity_type VARCHAR(32) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  before_json JSONB,
  after_json JSONB,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address VARCHAR(64),
  user_agent VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT csd_audit_actor_chk CHECK (actor_type IN ('user', 'system', 'ai', 'api'))
);
CREATE INDEX IF NOT EXISTS csd_audit_entity_idx
  ON csd_audit_logs (tenant_id, entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS csd_audit_actor_idx
  ON csd_audit_logs (tenant_id, actor_staff_id, created_at DESC);

CREATE TABLE IF NOT EXISTS csd_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES csd_tenants (id),
  staff_id INTEGER NOT NULL,
  event_key VARCHAR(64) NOT NULL,
  title_vi VARCHAR(255) NOT NULL,
  body_vi TEXT NOT NULL DEFAULT '',
  entity_type VARCHAR(32),
  entity_id VARCHAR(64),
  severity VARCHAR(16) NOT NULL DEFAULT 'info',
  read_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT csd_notifications_sev_chk CHECK (severity IN ('info', 'warning', 'critical'))
);
CREATE INDEX IF NOT EXISTS csd_notifications_inbox_idx
  ON csd_notifications (tenant_id, staff_id, created_at DESC);

CREATE TABLE IF NOT EXISTS csd_ai_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES csd_tenants (id),
  actor_staff_id INTEGER NOT NULL,
  feature VARCHAR(64) NOT NULL,
  prompt_hash VARCHAR(64) NOT NULL DEFAULT '',
  context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_text TEXT NOT NULL DEFAULT '',
  user_action VARCHAR(32) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT csd_ai_action_chk CHECK (user_action IN ('draft', 'insert', 'discard', 'apply', 'regenerate'))
);
CREATE INDEX IF NOT EXISTS csd_ai_actor_idx
  ON csd_ai_interactions (tenant_id, actor_staff_id, created_at DESC);

CREATE TABLE IF NOT EXISTS csd_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES csd_tenants (id),
  kind VARCHAR(32) NOT NULL,
  entity_type VARCHAR(32) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  requester_staff_id INTEGER NOT NULL,
  approver_staff_id INTEGER,
  due_at TIMESTAMPTZ,
  comment TEXT NOT NULL DEFAULT '',
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT csd_approvals_kind_chk CHECK (kind IN ('report', 'email', 'scope', 'send')),
  CONSTRAINT csd_approvals_status_chk CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested', 'cancelled'))
);
CREATE INDEX IF NOT EXISTS csd_approvals_queue_idx
  ON csd_approvals (tenant_id, status, due_at);

-- ---------------------------------------------------------------------------
-- Conversations / messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS csd_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES csd_tenants (id),
  kind VARCHAR(32) NOT NULL,
  name_vi VARCHAR(191) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  factory VARCHAR(8) NOT NULL DEFAULT 'A',
  client_account_id VARCHAR(64),
  customer_id INTEGER,
  project_ref_kind VARCHAR(32),
  project_ref_id VARCHAR(64),
  campaign_id VARCHAR(64),
  ticket_id UUID,
  owner_staff_id INTEGER,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_staff_id INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by_staff_id INTEGER,
  deleted_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT csd_conversations_kind_chk CHECK (kind IN (
    'direct', 'group', 'client', 'project', 'campaign', 'ticket', 'announcement', 'ai_assist'
  )),
  CONSTRAINT csd_conversations_status_chk CHECK (status IN ('active', 'archived', 'closed', 'reopened')),
  CONSTRAINT csd_conversations_factory_chk CHECK (factory = 'A')
);
CREATE INDEX IF NOT EXISTS csd_conversations_client_idx
  ON csd_conversations (tenant_id, client_account_id, last_message_at DESC)
  WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS csd_conversations_kind_idx
  ON csd_conversations (tenant_id, kind, status)
  WHERE is_deleted = FALSE;

CREATE TABLE IF NOT EXISTS csd_conversation_members (
  conversation_id UUID NOT NULL REFERENCES csd_conversations (id) ON DELETE CASCADE,
  member_type VARCHAR(16) NOT NULL,
  member_staff_id INTEGER,
  member_contact_id VARCHAR(64),
  role VARCHAR(16) NOT NULL DEFAULT 'member',
  muted BOOLEAN NOT NULL DEFAULT FALSE,
  last_read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT csd_conv_member_type_chk CHECK (member_type IN ('staff', 'client_contact')),
  CONSTRAINT csd_conv_member_role_chk CHECK (role IN ('owner', 'member', 'viewer'))
);
CREATE UNIQUE INDEX IF NOT EXISTS csd_conv_members_staff_uidx
  ON csd_conversation_members (conversation_id, member_staff_id)
  WHERE member_staff_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS csd_conv_members_staff_idx
  ON csd_conversation_members (member_staff_id);

CREATE TABLE IF NOT EXISTS csd_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES csd_tenants (id),
  conversation_id UUID NOT NULL REFERENCES csd_conversations (id) ON DELETE CASCADE,
  author_type VARCHAR(16) NOT NULL,
  author_staff_id INTEGER,
  author_contact_id VARCHAR(64),
  body_text TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  reply_to_id UUID REFERENCES csd_messages (id) ON DELETE SET NULL,
  visibility VARCHAR(16) NOT NULL DEFAULT 'client',
  delivery_status VARCHAR(16) NOT NULL DEFAULT 'sent',
  ticket_id UUID,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT csd_messages_author_chk CHECK (author_type IN ('staff', 'client_contact', 'system', 'ai')),
  CONSTRAINT csd_messages_vis_chk CHECK (visibility IN ('internal', 'client')),
  CONSTRAINT csd_messages_delivery_chk CHECK (delivery_status IN ('sent', 'delivered', 'failed'))
);
CREATE INDEX IF NOT EXISTS csd_messages_conv_idx
  ON csd_messages (conversation_id, created_at ASC)
  WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS csd_messages_ticket_idx
  ON csd_messages (ticket_id)
  WHERE ticket_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Tickets
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS csd_ticket_code_seq;

CREATE OR REPLACE FUNCTION csd_next_ticket_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 'PTT-' || to_char(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY')
    || '-' || lpad(nextval('csd_ticket_code_seq')::text, 6, '0');
END;
$$;

CREATE TABLE IF NOT EXISTS csd_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES csd_tenants (id),
  code VARCHAR(32) NOT NULL,
  factory VARCHAR(8) NOT NULL DEFAULT 'A',
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  ticket_type VARCHAR(64) NOT NULL,
  category VARCHAR(64) NOT NULL DEFAULT '',
  sub_category VARCHAR(64) NOT NULL DEFAULT '',
  status VARCHAR(32) NOT NULL DEFAULT 'new',
  priority VARCHAR(8) NOT NULL DEFAULT 'P3',
  severity VARCHAR(16) NOT NULL DEFAULT 'medium',
  scope_status VARCHAR(32) NOT NULL DEFAULT 'in_scope',
  source_type VARCHAR(32) NOT NULL DEFAULT 'manual',
  source_id VARCHAR(64),
  client_account_id VARCHAR(64),
  customer_id INTEGER,
  contact_id VARCHAR(64),
  contract_id VARCHAR(64),
  project_ref_kind VARCHAR(32),
  project_ref_id VARCHAR(64),
  campaign_id VARCHAR(64),
  service_package VARCHAR(64),
  lead_id INTEGER,
  lifecycle_id INTEGER,
  owner_staff_id INTEGER,
  assignee_staff_id INTEGER,
  team_code VARCHAR(64),
  sla_policy_id UUID REFERENCES csd_sla_policies (id),
  sla_response_due_at TIMESTAMPTZ,
  sla_resolution_due_at TIMESTAMPTZ,
  sla_status VARCHAR(16) NOT NULL DEFAULT 'on_track',
  sla_paused BOOLEAN NOT NULL DEFAULT FALSE,
  sla_paused_at TIMESTAMPTZ,
  sla_pause_reason TEXT,
  sla_paused_seconds INTEGER NOT NULL DEFAULT 0,
  first_response_at TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  eta_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  resolution_note TEXT NOT NULL DEFAULT '',
  reopen_count INTEGER NOT NULL DEFAULT 0,
  tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  estimated_effort_minutes INTEGER,
  actual_effort_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_staff_id INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by_staff_id INTEGER,
  deleted_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (tenant_id, code),
  CONSTRAINT csd_tickets_factory_chk CHECK (factory = 'A'),
  CONSTRAINT csd_tickets_priority_chk CHECK (priority IN ('P1', 'P2', 'P3', 'P4')),
  CONSTRAINT csd_tickets_status_chk CHECK (status IN (
    'draft', 'new', 'triaged', 'assigned', 'in_progress',
    'waiting_for_client', 'waiting_for_internal_approval', 'on_hold',
    'resolved', 'client_acceptance', 'closed',
    'cancelled', 'rejected', 'reopened', 'escalated'
  )),
  CONSTRAINT csd_tickets_scope_chk CHECK (scope_status IN (
    'in_scope', 'potentially_out_of_scope', 'out_of_scope',
    'included_by_exception', 'billable', 'warranty'
  )),
  CONSTRAINT csd_tickets_source_chk CHECK (source_type IN (
    'manual', 'chat_message', 'email', 'form', 'api', 'ai_draft', 'integration'
  )),
  CONSTRAINT csd_tickets_sla_chk CHECK (sla_status IN (
    'on_track', 'at_risk', 'near_breach', 'breached', 'paused', 'exempted'
  ))
);
CREATE UNIQUE INDEX IF NOT EXISTS csd_tickets_source_uidx
  ON csd_tickets (tenant_id, source_type, source_id)
  WHERE source_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS csd_tickets_queue_idx
  ON csd_tickets (tenant_id, status, priority, sla_resolution_due_at)
  WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS csd_tickets_assignee_idx
  ON csd_tickets (tenant_id, assignee_staff_id, status)
  WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS csd_tickets_client_idx
  ON csd_tickets (tenant_id, client_account_id, created_at DESC)
  WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS csd_tickets_sla_idx
  ON csd_tickets (tenant_id, sla_status, sla_resolution_due_at)
  WHERE is_deleted = FALSE AND status NOT IN ('closed', 'cancelled', 'rejected', 'draft');

ALTER TABLE csd_conversations
  DROP CONSTRAINT IF EXISTS csd_conversations_ticket_fk;
ALTER TABLE csd_conversations
  ADD CONSTRAINT csd_conversations_ticket_fk
  FOREIGN KEY (ticket_id) REFERENCES csd_tickets (id) ON DELETE SET NULL;

ALTER TABLE csd_messages
  DROP CONSTRAINT IF EXISTS csd_messages_ticket_fk;
ALTER TABLE csd_messages
  ADD CONSTRAINT csd_messages_ticket_fk
  FOREIGN KEY (ticket_id) REFERENCES csd_tickets (id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS csd_ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES csd_tenants (id),
  ticket_id UUID NOT NULL REFERENCES csd_tickets (id) ON DELETE CASCADE,
  visibility VARCHAR(16) NOT NULL,
  author_type VARCHAR(16) NOT NULL,
  author_staff_id INTEGER,
  author_contact_id VARCHAR(64),
  body_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT csd_ticket_comments_vis_chk CHECK (visibility IN ('public', 'internal')),
  CONSTRAINT csd_ticket_comments_author_chk CHECK (author_type IN ('staff', 'client_contact', 'system', 'ai'))
);
CREATE INDEX IF NOT EXISTS csd_ticket_comments_idx
  ON csd_ticket_comments (ticket_id, created_at ASC)
  WHERE is_deleted = FALSE;

CREATE TABLE IF NOT EXISTS csd_ticket_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES csd_tenants (id),
  ticket_id UUID NOT NULL REFERENCES csd_tickets (id) ON DELETE CASCADE,
  actor_type VARCHAR(16) NOT NULL DEFAULT 'user',
  actor_staff_id INTEGER,
  event_key VARCHAR(64) NOT NULL,
  from_value TEXT,
  to_value TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS csd_ticket_activities_idx
  ON csd_ticket_activities (ticket_id, created_at ASC);

CREATE TABLE IF NOT EXISTS csd_ticket_watchers (
  ticket_id UUID NOT NULL REFERENCES csd_tickets (id) ON DELETE CASCADE,
  staff_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ticket_id, staff_id)
);

CREATE TABLE IF NOT EXISTS csd_ticket_collaborators (
  ticket_id UUID NOT NULL REFERENCES csd_tickets (id) ON DELETE CASCADE,
  staff_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ticket_id, staff_id)
);

-- ---------------------------------------------------------------------------
-- Email
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS csd_mailboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES csd_tenants (id),
  code VARCHAR(64) NOT NULL,
  address VARCHAR(191) NOT NULL,
  purpose VARCHAR(32) NOT NULL DEFAULT 'support',
  imap_host VARCHAR(191),
  smtp_host VARCHAR(191),
  secret_ref VARCHAR(191),
  auto_create_ticket BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  degraded BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code),
  CONSTRAINT csd_mailboxes_purpose_chk CHECK (purpose IN ('support', 'report', 'shared'))
);

CREATE TABLE IF NOT EXISTS csd_mailbox_grants (
  mailbox_id UUID NOT NULL REFERENCES csd_mailboxes (id) ON DELETE CASCADE,
  staff_id INTEGER NOT NULL,
  can_send BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (mailbox_id, staff_id)
);

CREATE TABLE IF NOT EXISTS csd_email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES csd_tenants (id),
  mailbox_id UUID REFERENCES csd_mailboxes (id) ON DELETE SET NULL,
  subject VARCHAR(255) NOT NULL DEFAULT '',
  client_account_id VARCHAR(64),
  ticket_id UUID REFERENCES csd_tickets (id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS csd_email_threads_ticket_idx
  ON csd_email_threads (ticket_id);

CREATE TABLE IF NOT EXISTS csd_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES csd_tenants (id),
  thread_id UUID REFERENCES csd_email_threads (id) ON DELETE SET NULL,
  mailbox_id UUID REFERENCES csd_mailboxes (id) ON DELETE SET NULL,
  direction VARCHAR(8) NOT NULL,
  provider_message_id VARCHAR(255),
  from_address VARCHAR(191) NOT NULL DEFAULT '',
  to_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  cc_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  bcc_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  subject VARCHAR(255) NOT NULL DEFAULT '',
  body_text TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  send_status VARCHAR(16) NOT NULL DEFAULT 'received',
  matched_client_account_id VARCHAR(64),
  ticket_id UUID REFERENCES csd_tickets (id) ON DELETE SET NULL,
  assigned_staff_id INTEGER,
  ignored BOOLEAN NOT NULL DEFAULT FALSE,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  failed_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_staff_id INTEGER,
  CONSTRAINT csd_emails_dir_chk CHECK (direction IN ('in', 'out')),
  CONSTRAINT csd_emails_status_chk CHECK (send_status IN (
    'received', 'draft', 'queued', 'sent', 'failed', 'bounced', 'scheduled'
  ))
);
CREATE UNIQUE INDEX IF NOT EXISTS csd_emails_provider_uidx
  ON csd_emails (tenant_id, provider_message_id)
  WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS csd_emails_unmatched_idx
  ON csd_emails (tenant_id, direction, matched_client_account_id)
  WHERE direction = 'in' AND matched_client_account_id IS NULL AND ignored = FALSE;
CREATE INDEX IF NOT EXISTS csd_emails_ticket_idx
  ON csd_emails (ticket_id);

CREATE TABLE IF NOT EXISTS csd_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES csd_tenants (id),
  code VARCHAR(64) NOT NULL,
  name_vi VARCHAR(191) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body_html TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code, version),
  CONSTRAINT csd_email_templates_status_chk CHECK (status IN ('draft', 'approved', 'archived'))
);

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS csd_report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES csd_tenants (id),
  code VARCHAR(64) NOT NULL,
  name_vi VARCHAR(191) NOT NULL,
  requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
  sections_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

INSERT INTO csd_report_templates (tenant_id, code, name_vi, requires_approval, sections_json)
VALUES
  ('PTT', 'weekly_ops', 'Báo cáo vận hành tuần', FALSE,
   '["cover","executive_summary","ticket_sla","work_completed","risks","next_week"]'::jsonb),
  ('PTT', 'monthly_marketing', 'Báo cáo marketing tháng', TRUE,
   '["cover","executive_summary","kpi","channels","work_completed","risks","next_month","appendix"]'::jsonb),
  ('PTT', 'monthly_sla', 'Báo cáo ticket/SLA tháng', TRUE,
   '["cover","sla_kpis","breaches","reopens","recommendations"]'::jsonb),
  ('PTT', 'executive', 'Báo cáo điều hành', TRUE,
   '["cover","executive_summary","kpi","risks","asks"]'::jsonb)
ON CONFLICT (tenant_id, code) DO NOTHING;

CREATE TABLE IF NOT EXISTS csd_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES csd_tenants (id),
  template_id UUID REFERENCES csd_report_templates (id),
  title VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  client_account_id VARCHAR(64),
  project_ref_kind VARCHAR(32),
  project_ref_id VARCHAR(64),
  campaign_id VARCHAR(64),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  owner_staff_id INTEGER,
  approver_staff_id INTEGER,
  current_version VARCHAR(16) NOT NULL DEFAULT 'v1.0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_staff_id INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by_staff_id INTEGER,
  deleted_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT csd_reports_status_chk CHECK (status IN (
    'draft', 'data_pending', 'in_review', 'changes_requested',
    'approved', 'scheduled', 'sent', 'viewed', 'acknowledged', 'archived', 'cancelled'
  )),
  CONSTRAINT csd_reports_period_chk CHECK (period_end >= period_start)
);
CREATE INDEX IF NOT EXISTS csd_reports_queue_idx
  ON csd_reports (tenant_id, status, period_end DESC)
  WHERE is_deleted = FALSE;

CREATE TABLE IF NOT EXISTS csd_report_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES csd_reports (id) ON DELETE CASCADE,
  version VARCHAR(16) NOT NULL,
  status VARCHAR(32) NOT NULL,
  sections_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  changelog TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_staff_id INTEGER,
  UNIQUE (report_id, version)
);

CREATE TABLE IF NOT EXISTS csd_report_send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES csd_reports (id) ON DELETE CASCADE,
  version VARCHAR(16) NOT NULL,
  channel VARCHAR(16) NOT NULL,
  to_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  result VARCHAR(16) NOT NULL,
  email_id UUID REFERENCES csd_emails (id) ON DELETE SET NULL,
  error_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_staff_id INTEGER,
  CONSTRAINT csd_report_send_channel_chk CHECK (channel IN ('email', 'chat', 'portal')),
  CONSTRAINT csd_report_send_result_chk CHECK (result IN ('queued', 'sent', 'failed'))
);

CREATE TABLE IF NOT EXISTS csd_report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES csd_tenants (id),
  template_id UUID NOT NULL REFERENCES csd_report_templates (id),
  client_account_id VARCHAR(64),
  recurrence VARCHAR(16) NOT NULL,
  next_run_at TIMESTAMPTZ,
  owner_staff_id INTEGER,
  approver_staff_id INTEGER,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT csd_report_schedules_rec_chk CHECK (recurrence IN ('weekly', 'monthly', 'quarterly', 'custom'))
);

-- ---------------------------------------------------------------------------
-- Idempotency for mutating POSTs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS csd_idempotency_keys (
  tenant_id VARCHAR(32) NOT NULL,
  idempotency_key VARCHAR(64) NOT NULL,
  entity_type VARCHAR(32) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, idempotency_key)
);

-- ---------------------------------------------------------------------------
-- Chat accounts + friendships (dock Z1–Z16)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS csd_chat_accounts (
  staff_id              integer PRIMARY KEY,
  tenant_id             text NOT NULL DEFAULT 'PTT',
  enabled               boolean NOT NULL DEFAULT true,
  display_name_vi       text,
  username              text,
  password_hash         text,
  created_by_staff_id   integer NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE csd_chat_accounts ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE csd_chat_accounts ADD COLUMN IF NOT EXISTS password_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS csd_chat_accounts_username_uidx
  ON csd_chat_accounts (tenant_id, lower(btrim(username)))
  WHERE username IS NOT NULL AND btrim(username) <> '';

CREATE TABLE IF NOT EXISTS csd_chat_friendships (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             text NOT NULL DEFAULT 'PTT',
  staff_lo              integer NOT NULL,
  staff_hi              integer NOT NULL,
  requester_staff_id    integer NOT NULL,
  addressee_staff_id    integer NOT NULL,
  status                text NOT NULL CHECK (status IN ('pending','accepted','blocked')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (staff_lo < staff_hi),
  UNIQUE (tenant_id, staff_lo, staff_hi)
);

CREATE INDEX IF NOT EXISTS csd_chat_friendships_inbox_idx
  ON csd_chat_friendships (addressee_staff_id, status);
