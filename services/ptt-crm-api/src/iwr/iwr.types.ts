export const IWR_TENANT_ID = 'PTT';
export const IWR_TZ = 'Asia/Ho_Chi_Minh';
export const IWR_DAILY_DUE_HOUR = 17;

export const IWR_STATUSES = [
  'draft',
  'submitted',
  'changes_requested',
  'supplemented',
  'acknowledged',
  'waived',
  'archived',
] as const;
export type IwrReportStatus = (typeof IWR_STATUSES)[number];

export const IWR_TEMPLATE_CODES = ['daily_work', 'weekly_work', 'monthly_work'] as const;
export type IwrTemplateCode = (typeof IWR_TEMPLATE_CODES)[number];

export type IwrRecipientKind = 'to' | 'cc' | 'bcc';
export type IwrInboxBox =
  | 'action'
  | 'unread'
  | 'inbox'
  | 'sent'
  | 'draft'
  | 'waiting'
  | 'needs_changes'
  | 'blockers'
  | 'approvals'
  | 'archived'
  | 'trash';
export type IwrRag = 'green' | 'yellow' | 'red' | 'gray' | null;

export type IwrCapAction =
  | 'view'
  | 'write'
  | 'review'
  | 'lists'
  | 'schedule'
  | 'export'
  | 'manage'
  | 'executive'
  | 'bcc'
  | 'external';

export type IwrActor = {
  staffId: number;
  staffLabel: string;
  departmentId: number | null;
  caps: { section: string; action: string }[];
};

export type IwrPeriod = {
  period_start: string;
  period_end: string;
  due_at: string;
};

export type IwrStaffNode = {
  id: number;
  name: string;
  email: string | null;
  department_id: number | null;
  reports_to_id: number | null;
  active: boolean;
};

export const IWR_DAILY_SECTIONS = [
  'general',
  'done',
  'wip',
  'next',
  'blocked',
  'approvals',
  'notes',
] as const;

export const IWR_WEEKLY_SECTIONS = [
  'rag',
  'priorities',
  'highlights',
  'kpi',
  'deliverables',
  'wip',
  'blocked',
  'plan_vs_actual',
  'next_week',
  'decisions',
] as const;

export const IWR_MONTHLY_SECTIONS = [
  ...IWR_WEEKLY_SECTIONS,
  'month_highlights',
  'people',
] as const;

export type IwrSectionValue = { body: string; items: unknown[] };

export type IwrTemplateRow = {
  id: string;
  code: IwrTemplateCode | string;
  name_vi: string;
  kind: string;
  sections_json: string[];
  due_rule_json: Record<string, unknown>;
  active: boolean;
};

export type IwrRecipientRow = {
  id: string;
  report_id: string;
  staff_id: number;
  kind: IwrRecipientKind;
  staff_name?: string;
};

export type IwrCommentRow = {
  id: string;
  report_id: string;
  section_key: string;
  body_text: string;
  created_by_staff_id: number;
  created_at: string;
};

export type IwrReportRow = {
  id: string;
  template_id: string;
  template_code: string;
  template_name_vi: string;
  title: string;
  author_staff_id: number;
  author_name?: string;
  reviewer_staff_id: number | null;
  period_start: string;
  period_end: string;
  due_at: string;
  status: IwrReportStatus;
  version: string;
  rag: IwrRag;
  is_late: boolean;
  late_reason: string | null;
  first_viewed_at: string | null;
  first_viewed_by_staff_id?: number | null;
  rag_override_reason?: string | null;
  submitted_at: string | null;
  acknowledged_at: string | null;
  acknowledged_by_staff_id?: number | null;
  waived_at?: string | null;
  waived_by_staff_id?: number | null;
  waive_reason?: string | null;
  sensitivity?: string;
  sections_json: Record<string, unknown>;
  source_report_ids?: string[];
};

export type IwrListKind = 'static' | 'department' | 'role' | 'rule';

export type IwrListRow = {
  id: string;
  code: string;
  name_vi: string;
  owner_staff_id: number;
  kind: IwrListKind;
  rule_json: Record<string, unknown>;
  active: boolean;
};

export type IwrRiskRow = {
  id: string;
  report_id: string | null;
  item_id: string | null;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  owner_staff_id: number | null;
  status: 'open' | 'mitigating' | 'closed';
  due_at: string | null;
};

export type IwrDeliveryLogRow = {
  id: string;
  report_id: string;
  distribution_id: string | null;
  channel: string;
  status: string;
  to_snapshot: number[];
  cc_snapshot: number[];
  bcc_snapshot: number[];
  created_at: string;
};

export type IwrItemRefKind = 'csd_ticket' | 'lead' | 'customer' | 'url' | 'none';

export type IwrItemRow = {
  id: string;
  report_id: string;
  section_key: string;
  title: string;
  body: string;
  ref_kind: IwrItemRefKind;
  ref_id: string | null;
  evidence_url: string | null;
  sort_order: number;
};

export type IwrRagHint = {
  rag: Exclude<IwrRag, null>;
  reasons: string[];
};

export type IwrSuggestHit = {
  kind: 'csd_ticket' | 'lead';
  id: string;
  label: string;
  reason: 'closed_today' | 'updated_today' | 'overdue' | 'blocked';
};

export type IwrReportDetail = IwrReportRow & {
  recipients: IwrRecipientRow[];
  comments: IwrCommentRow[];
  versions: { version: string; status: string; created_at: string }[];
  items?: IwrItemRow[];
  rag_hint?: IwrRagHint;
  rag_override_reason?: string | null;
  viewer_is_author?: boolean;
  viewer_is_reviewer?: boolean;
};

export type IwrTeamNode = IwrStaffNode & {
  report: IwrReportRow | null;
  derived: 'missing' | 'draft' | 'submitted' | 'late' | 'waived' | 'acked';
};

export type CreateIwrReportInput = {
  template_code: IwrTemplateCode;
  period_start?: string;
  period_end?: string;
};

export type PatchIwrReportInput = {
  title?: string;
  sections_json?: Record<string, unknown>;
  rag?: IwrRag;
  rag_override_reason?: string;
  cc_staff_ids?: number[];
  source_report_ids?: string[];
};

export type SubmitIwrReportInput = {
  late_reason?: string;
  cc_staff_ids?: number[];
  bcc_staff_ids?: number[];
  cc_list_ids?: string[];
};

export type RequestIwrChangesInput = {
  body_text: string;
  section_key?: string;
};

export type WaiveIwrReportInput = {
  reason: string;
};

export type AddIwrCommentInput = {
  body_text: string;
  section_key?: string;
};

export type UpdateIwrTemplateInput = {
  name_vi?: string;
  sections_json?: string[];
  due_rule_json?: Record<string, unknown>;
};

export type IwrDashRole = 'staff' | 'leader' | 'pm' | 'bod';

export type IwrDashStaff = {
  due_today: boolean;
  inbox_unread: number;
  my_late_rate_30d: number;
  open_blockers: number;
};

export type IwrDashLeader = {
  submitted: number;
  missing: number;
  late: number;
  action_needed: number;
  rag_red: number;
  open_blockers: number;
};

export type IwrDashPm = {
  client_blockers: number;
  unread_over_sla: number;
  overdue_tickets: number;
};

export type IwrDashBod = {
  submit_rate: number;
  rag_red_list: { report_id: string; author_name: string }[];
  critical_risks: number;
  pending_acks: number;
};

export type IwrScheduleKind = 'reminder' | 'digest' | 'precreate';

export type IwrScheduleRow = {
  id: string;
  kind: IwrScheduleKind;
  cron_expr: string;
  timezone: string;
  channel: 'in_app';
  active: boolean;
  next_run_at: string | null;
};

export type IwrDelegationRow = {
  id: string;
  delegator_staff_id: number;
  delegate_staff_id: number;
  starts_at: string;
  ends_at: string;
  active: boolean;
};

export type SendIwrEmailInput = {
  to: string[];
  subject: string;
  body_text: string;
};
