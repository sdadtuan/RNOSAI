export const CSD_TICKET_STATUSES = [
  'draft',
  'new',
  'triaged',
  'assigned',
  'in_progress',
  'waiting_for_client',
  'waiting_for_internal_approval',
  'on_hold',
  'resolved',
  'client_acceptance',
  'closed',
  'cancelled',
  'rejected',
  'reopened',
  'escalated',
] as const;

export type CsdTicketStatus = (typeof CSD_TICKET_STATUSES)[number];
export type CsdPriority = 'P1' | 'P2' | 'P3' | 'P4';
export type CsdSlaStatus = 'on_track' | 'at_risk' | 'near_breach' | 'breached' | 'paused' | 'exempted';
export type CsdScopeStatus =
  | 'in_scope'
  | 'potentially_out_of_scope'
  | 'out_of_scope'
  | 'included_by_exception'
  | 'billable'
  | 'warranty';

export type CsdAttachmentVisibility = 'internal' | 'client' | 'restricted';

export type CsdSlaPolicySlice = {
  workday_start: string;
  workday_end: string;
  workdays: number[];
  holidays: string[];
  at_risk_pct: number;
  near_breach_pct: number;
};

export type CsdSourceType = 'manual' | 'chat_message' | 'email' | 'form' | 'ai_draft';

export const CSD_TENANT_ID = 'PTT';

export type CsdTicketRow = {
  id: string;
  tenant_id: string;
  code: string;
  factory: string;
  title: string;
  description: string;
  ticket_type: string;
  category: string;
  sub_category: string;
  status: CsdTicketStatus;
  priority: CsdPriority;
  severity: string;
  scope_status: CsdScopeStatus;
  source_type: CsdSourceType;
  source_id: string | null;
  client_account_id: string | null;
  customer_id: number | null;
  assignee_staff_id: number | null;
  owner_staff_id: number | null;
  sla_policy_id: string | null;
  sla_response_due_at: string | null;
  sla_resolution_due_at: string | null;
  sla_status: CsdSlaStatus;
  sla_paused: boolean;
  sla_paused_seconds: number;
  resolution_note: string;
  created_at: string;
  created_by_staff_id: number | null;
  updated_at: string;
  updated_by_staff_id: number | null;
  assigned_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  first_response_at: string | null;
};

export type CsdTicketCommentRow = {
  id: string;
  tenant_id: string;
  ticket_id: string;
  visibility: 'public' | 'internal';
  author_type: string;
  author_staff_id: number | null;
  body_text: string;
  created_at: string;
};

export type CsdTicketActivityRow = {
  id: string;
  tenant_id: string;
  ticket_id: string;
  actor_type: string;
  actor_staff_id: number | null;
  event_key: string;
  from_value: string | null;
  to_value: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
};

export type CsdSlaPolicyRow = {
  id: string;
  tenant_id: string;
  code: string;
  name_vi: string;
  workday_start: string;
  workday_end: string;
  workdays: number[];
  at_risk_pct: number;
  near_breach_pct: number;
  pause_on_waiting_client: boolean;
  pause_on_internal_approval: boolean;
};

export type CsdSlaPolicyTargetRow = {
  policy_id: string;
  priority: CsdPriority;
  response_minutes: number;
  resolution_minutes: number;
};

export type CreateCsdTicketInput = {
  title: string;
  description?: string;
  ticket_type: string;
  priority: CsdPriority;
  client_account_id?: string;
  customer_id?: number | null;
  source_type?: CsdSourceType;
  source_id?: string | null;
  assignee_staff_id?: number | null;
  idempotency_key?: string;
};

export type CsdTicketListQuery = {
  status?: CsdTicketStatus;
  priority?: CsdPriority;
  assignee_staff_id?: number;
  client_account_id?: string;
  q?: string;
  limit?: number;
  cursor?: string;
};

export type InsertCsdTicketInput = {
  code: string;
  title: string;
  description: string;
  ticket_type: string;
  priority: CsdPriority;
  status: CsdTicketStatus;
  source_type: CsdSourceType;
  source_id: string | null;
  client_account_id: string | null;
  customer_id: number | null;
  assignee_staff_id: number | null;
  sla_policy_id: string;
  sla_response_due_at: Date;
  sla_resolution_due_at: Date;
  created_by_staff_id: number;
};

export type CsdActor = {
  staffId: number;
  staffLabel: string;
  caps: { section: string; action: string }[];
};

export type CsdConversationKind =
  | 'direct'
  | 'group'
  | 'client'
  | 'project'
  | 'campaign'
  | 'ticket'
  | 'announcement'
  | 'ai_assist';

export type CsdConversationRow = {
  id: string;
  tenant_id: string;
  kind: CsdConversationKind;
  name_vi: string;
  description: string;
  status: string;
  client_account_id: string | null;
  project_ref_kind: string | null;
  project_ref_id: string | null;
  ticket_id: string | null;
  owner_staff_id: number | null;
  last_message_at: string | null;
  created_at: string;
  created_by_staff_id: number | null;
};

export type CsdMessageRow = {
  id: string;
  tenant_id: string;
  conversation_id: string;
  author_type: string;
  author_staff_id: number | null;
  body_text: string;
  reply_to_id: string | null;
  visibility: 'internal' | 'client';
  ticket_id: string | null;
  created_at: string;
};

export type CreateCsdConversationInput = {
  kind: CsdConversationKind;
  name_vi: string;
  client_account_id?: string;
  project_ref_kind?: string;
  project_ref_id?: string;
};

export type SendCsdMessageInput = {
  body_text: string;
  reply_to_id?: string;
  visibility?: 'internal' | 'client';
};

export type CsdEmailRow = {
  id: string;
  tenant_id: string;
  thread_id: string | null;
  direction: 'in' | 'out';
  provider_message_id: string | null;
  from_address: string;
  to_json: string[];
  subject: string;
  body_text: string;
  send_status: string;
  matched_client_account_id: string | null;
  ticket_id: string | null;
  ignored: boolean;
  sent_at: string | null;
  created_at: string;
  created_by_staff_id: number | null;
};

export type SendCsdEmailInput = {
  to: string[];
  subject: string;
  body_text: string;
  body_html?: string;
  ticket_id?: string;
  client_account_id?: string;
};

export type InboundCsdEmailInput = {
  provider_message_id: string;
  from_address: string;
  to_json: string[];
  subject: string;
  body_text: string;
  body_html?: string;
  headers?: Record<string, string>;
};

export type CsdReportStatus =
  | 'draft'
  | 'data_pending'
  | 'in_review'
  | 'changes_requested'
  | 'approved'
  | 'scheduled'
  | 'sent'
  | 'viewed'
  | 'acknowledged'
  | 'archived'
  | 'cancelled';

export type CsdReportRow = {
  id: string;
  tenant_id: string;
  template_id: string | null;
  template_code: string | null;
  title: string;
  status: CsdReportStatus;
  client_account_id: string | null;
  period_start: string;
  period_end: string;
  owner_staff_id: number | null;
  approver_staff_id: number | null;
  current_version: string;
  requires_approval: boolean;
  created_at: string;
  created_by_staff_id: number | null;
  updated_at: string;
};

export type CsdReportVersionRow = {
  id: string;
  report_id: string;
  version: string;
  status: CsdReportStatus;
  sections_json: Record<string, unknown>;
  changelog: string;
  created_at: string;
  created_by_staff_id: number | null;
};

export type CsdReportSendLogRow = {
  id: string;
  report_id: string;
  version: string;
  channel: string;
  to_json: string[];
  result: string;
  email_id: string | null;
  created_at: string;
  created_by_staff_id: number | null;
};

export type CreateCsdReportInput = {
  template_code: string;
  client_account_id?: string;
  period_start: string;
  period_end: string;
  title?: string;
};

export type SendCsdReportInput = {
  to: string[];
  subject: string;
  body: string;
};
