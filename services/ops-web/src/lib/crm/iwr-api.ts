import { API_BASE, ApiError, parseJson } from '@/lib/api';

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

export const IWR_STATUS_LABELS: Record<IwrReportStatus, string> = {
  draft: 'Nháp',
  submitted: 'Đã gửi',
  changes_requested: 'Cần bổ sung',
  supplemented: 'Đã bổ sung',
  acknowledged: 'Đã xác nhận',
  waived: 'Không cần nộp',
  archived: 'Lưu trữ',
};

export const IWR_RAG_LABELS: Record<Exclude<IwrRag, null>, string> = {
  green: 'Xanh',
  yellow: 'Vàng',
  red: 'Đỏ',
  gray: 'Xám',
};

export const IWR_TEMPLATE_CODES = [
  { code: 'daily_work', label: 'Báo cáo ngày' },
  { code: 'weekly_work', label: 'Báo cáo tuần' },
  { code: 'monthly_work', label: 'Báo cáo tháng' },
] as const;

export interface IwrStaffNode {
  id: number;
  name: string;
  email: string | null;
  department_id: number | null;
  reports_to_id: number | null;
  active: boolean;
}

export interface IwrReportRow {
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
  source_report_ids?: string[];
  submitted_at: string | null;
  acknowledged_at: string | null;
  sections_json: Record<string, { body?: string; items?: unknown[] }>;
}

export interface IwrRecipientRow {
  id: string;
  report_id: string;
  staff_id: number;
  kind: 'to' | 'cc' | 'bcc';
  staff_name?: string;
}

export interface IwrCommentRow {
  id: string;
  report_id: string;
  section_key: string;
  body_text: string;
  created_by_staff_id: number;
  created_at: string;
}

export type IwrItemRefKind = 'csd_ticket' | 'lead' | 'customer' | 'url' | 'none';

export interface IwrItemRow {
  id: string;
  report_id: string;
  section_key: string;
  title: string;
  body: string;
  ref_kind: IwrItemRefKind;
  ref_id: string | null;
  evidence_url: string | null;
  sort_order: number;
}

export interface IwrRagHint {
  rag: Exclude<IwrRag, null>;
  reasons: string[];
}

export interface IwrSuggestHit {
  kind: 'csd_ticket' | 'lead';
  id: string;
  label: string;
  reason: 'closed_today' | 'updated_today' | 'overdue' | 'blocked';
}

export interface IwrReportDetail extends IwrReportRow {
  recipients: IwrRecipientRow[];
  comments: IwrCommentRow[];
  versions: { version: string; status: string; created_at: string }[];
  items?: IwrItemRow[];
  rag_hint?: IwrRagHint;
  rag_override_reason?: string | null;
  viewer_is_author?: boolean;
  viewer_is_reviewer?: boolean;
}

export interface IwrTemplateRow {
  id: string;
  code: string;
  name_vi: string;
  kind: string;
  sections_json: string[];
  due_rule_json: Record<string, unknown>;
  active: boolean;
}

export interface IwrTeamNode extends IwrStaffNode {
  report: IwrReportRow | null;
  derived: 'missing' | 'draft' | 'submitted' | 'late' | 'waived' | 'acked';
}

const SECTION_LABELS: Record<string, string> = {
  general: 'Thông tin chung',
  done: 'Việc xong',
  wip: 'Đang làm',
  next: 'Kế hoạch tiếp',
  blocked: 'Blocker',
  approvals: 'Yêu cầu phê duyệt',
  notes: 'Ghi chú',
  rag: 'RAG',
  priorities: 'Ưu tiên',
  highlights: 'Highlights',
  kpi: 'KPI',
  deliverables: 'Deliverable',
  wip_weekly: 'WIP',
  plan_vs_actual: 'Plan vs actual',
  next_week: 'Tuần sau',
  decisions: 'Cần quyết định',
  month_highlights: 'Highlights tháng',
  people: 'People',
};

export function iwrSectionLabel(key: string): string {
  return SECTION_LABELS[key] ?? key;
}

async function iwrFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };
  if (init?.body && !headers['Content-Type'] && typeof init.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: 'no-store' });
  const body = await parseJson<T & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'IWR request failed', res.status);
  }
  return body;
}

export async function fetchIwrReports(
  token: string,
  query?: Record<string, string>,
): Promise<{ items: IwrReportRow[] }> {
  const qs = query ? `?${new URLSearchParams(query)}` : '';
  return iwrFetch(token, `/api/crm/iwr/reports${qs}`);
}

export async function createIwrReport(
  token: string,
  input: { template_code: string; period_start?: string; period_end?: string },
): Promise<IwrReportDetail> {
  return iwrFetch(token, '/api/crm/iwr/reports', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchIwrReport(token: string, id: string): Promise<IwrReportDetail> {
  return iwrFetch(token, `/api/crm/iwr/reports/${id}`);
}

export async function patchIwrReport(
  token: string,
  id: string,
  body: Record<string, unknown>,
): Promise<IwrReportDetail> {
  return iwrFetch(token, `/api/crm/iwr/reports/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function submitIwrReport(
  token: string,
  id: string,
  body?: { late_reason?: string; cc_staff_ids?: number[]; bcc_staff_ids?: number[]; cc_list_ids?: string[] },
): Promise<IwrReportDetail> {
  return iwrFetch(token, `/api/crm/iwr/reports/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export async function withdrawIwrReport(token: string, id: string): Promise<IwrReportDetail> {
  return iwrFetch(token, `/api/crm/iwr/reports/${id}/withdraw`, { method: 'POST', body: '{}' });
}

export async function ackIwrReport(token: string, id: string): Promise<IwrReportDetail> {
  return iwrFetch(token, `/api/crm/iwr/reports/${id}/acknowledge`, { method: 'POST', body: '{}' });
}

export async function requestIwrChanges(
  token: string,
  id: string,
  body: { body_text: string; section_key?: string },
): Promise<IwrReportDetail> {
  return iwrFetch(token, `/api/crm/iwr/reports/${id}/request-changes`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function waiveIwrReport(
  token: string,
  id: string,
  body: { reason: string },
): Promise<IwrReportDetail> {
  return iwrFetch(token, `/api/crm/iwr/reports/${id}/waive`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchIwrInbox(
  token: string,
  box: IwrInboxBox,
): Promise<{ items: IwrReportRow[] }> {
  return iwrFetch(token, `/api/crm/iwr/inbox?box=${encodeURIComponent(box)}`);
}

export async function fetchIwrDirectory(
  token: string,
  q: string,
  purpose: string,
): Promise<{ items: IwrStaffNode[] }> {
  const qs = new URLSearchParams({ q, purpose });
  return iwrFetch(token, `/api/crm/iwr/directory?${qs}`);
}

export async function fetchIwrTeam(
  token: string,
  qs: Record<string, string>,
): Promise<{ nodes: IwrTeamNode[] }> {
  return iwrFetch(token, `/api/crm/iwr/team?${new URLSearchParams(qs)}`);
}

export async function fetchIwrTemplates(token: string): Promise<{ items: IwrTemplateRow[] }> {
  return iwrFetch(token, '/api/crm/iwr/templates');
}

export async function updateIwrTemplate(
  token: string,
  id: string,
  body: { name_vi?: string },
): Promise<IwrTemplateRow> {
  return iwrFetch(token, `/api/crm/iwr/templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function addIwrComment(
  token: string,
  id: string,
  body: { body_text: string; section_key?: string },
): Promise<IwrReportDetail> {
  return iwrFetch(token, `/api/crm/iwr/reports/${id}/comments`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchIwrComments(
  token: string,
  id: string,
  sectionKey?: string,
): Promise<{ items: IwrCommentRow[] }> {
  const qs = sectionKey != null ? `?section_key=${encodeURIComponent(sectionKey)}` : '';
  return iwrFetch(token, `/api/crm/iwr/reports/${id}/comments${qs}`);
}

export function iwrPdfUrl(id: string): string {
  return `${API_BASE}/api/crm/iwr/reports/${id}/export.pdf`;
}

export function iwrXlsxUrl(id: string): string {
  return `${API_BASE}/api/crm/iwr/reports/${id}/export.xlsx`;
}

export function iwrCsvUrl(id: string): string {
  return `${API_BASE}/api/crm/iwr/reports/${id}/export.csv`;
}

export async function fetchIwrItems(token: string, id: string): Promise<{ items: IwrItemRow[] }> {
  return iwrFetch(token, `/api/crm/iwr/reports/${id}/items`);
}

export async function addIwrItem(
  token: string,
  id: string,
  body: Omit<IwrItemRow, 'id' | 'report_id'>,
): Promise<IwrItemRow> {
  return iwrFetch(token, `/api/crm/iwr/reports/${id}/items`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchIwrSuggest(token: string, id: string): Promise<{ items: IwrSuggestHit[] }> {
  return iwrFetch(token, `/api/crm/iwr/reports/${id}/suggest`);
}

export async function fetchIwrSources(token: string, id: string): Promise<{ items: IwrReportRow[] }> {
  return iwrFetch(token, `/api/crm/iwr/reports/${id}/sources`);
}

export async function applyIwrSources(
  token: string,
  id: string,
  source_report_ids: string[],
): Promise<IwrReportDetail> {
  return iwrFetch(token, `/api/crm/iwr/reports/${id}/sources`, {
    method: 'POST',
    body: JSON.stringify({ source_report_ids }),
  });
}

export async function markIwrViewed(token: string, id: string): Promise<{ first_viewed_at: string }> {
  return iwrFetch(token, `/api/crm/iwr/reports/${id}/viewed`, { method: 'POST', body: '{}' });
}

export async function backfillIwrReport(token: string, ymd: string): Promise<IwrReportDetail> {
  return iwrFetch(token, '/api/crm/iwr/reports/backfill', {
    method: 'POST',
    body: JSON.stringify({ ymd }),
  });
}

export interface IwrListRow {
  id: string;
  code: string;
  name_vi: string;
  owner_staff_id: number;
  kind: 'static' | 'department' | 'role' | 'rule';
  rule_json: Record<string, unknown>;
  active: boolean;
}

export interface IwrRiskRow {
  id: string;
  report_id: string | null;
  item_id: string | null;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  owner_staff_id: number | null;
  status: 'open' | 'mitigating' | 'closed';
  due_at: string | null;
}

export async function fetchIwrLists(token: string): Promise<{ items: IwrListRow[] }> {
  return iwrFetch(token, '/api/crm/iwr/lists');
}

export async function createIwrList(
  token: string,
  body: Omit<IwrListRow, 'id' | 'owner_staff_id'>,
): Promise<IwrListRow> {
  return iwrFetch(token, '/api/crm/iwr/lists', { method: 'POST', body: JSON.stringify(body) });
}

export async function fetchIwrSearch(token: string, q: string): Promise<{ items: IwrReportRow[] }> {
  return iwrFetch(token, `/api/crm/iwr/search?q=${encodeURIComponent(q)}`);
}

export async function replyIwrReport(
  token: string,
  id: string,
  body: { body_text: string; mention_staff_ids?: number[] },
): Promise<IwrCommentRow> {
  return iwrFetch(token, `/api/crm/iwr/reports/${id}/reply`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function replyAllIwrReport(
  token: string,
  id: string,
  body: { body_text: string },
): Promise<IwrCommentRow> {
  return iwrFetch(token, `/api/crm/iwr/reports/${id}/reply-all`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function forwardIwrReport(
  token: string,
  id: string,
  body: { to_staff_ids: number[]; note: string },
): Promise<{ distribution_id: string }> {
  return iwrFetch(token, `/api/crm/iwr/reports/${id}/forward`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function promoteIwrBlockerToRisk(
  token: string,
  reportId: string,
  itemId: string,
): Promise<IwrRiskRow> {
  return iwrFetch(token, '/api/crm/iwr/risks', {
    method: 'POST',
    body: JSON.stringify({ report_id: reportId, item_id: itemId }),
  });
}

export type IwrDashRole = 'staff' | 'leader' | 'pm' | 'bod';

export interface IwrDashLeader {
  submitted: number;
  missing: number;
  late: number;
  action_needed: number;
  rag_red: number;
  open_blockers: number;
}

export interface IwrDashStaff {
  due_today: boolean;
  inbox_unread: number;
  my_late_rate_30d: number;
  open_blockers: number;
}

export async function fetchIwrDashboard(token: string, role: IwrDashRole): Promise<unknown> {
  return iwrFetch(token, `/api/crm/iwr/dashboards/${role}`);
}

export async function fetchIwrRisks(token: string): Promise<{ items: IwrRiskRow[] }> {
  return iwrFetch(token, '/api/crm/iwr/risks');
}

export interface IwrScheduleRow {
  id: string;
  kind: 'reminder' | 'digest' | 'precreate';
  cron_expr: string;
  timezone: string;
  channel: 'in_app';
  active: boolean;
  next_run_at: string | null;
}

export async function fetchIwrSchedules(token: string): Promise<{ items: IwrScheduleRow[] }> {
  return iwrFetch(token, '/api/crm/iwr/schedules');
}

export async function sendIwrReportEmail(
  token: string,
  reportId: string,
  body: { to: string[]; subject: string; body_text: string },
): Promise<unknown> {
  return iwrFetch(token, `/api/crm/iwr/reports/${reportId}/send-email`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export interface IwrSavedReport {
  id: string;
  name_vi: string;
  owner_staff_id: number;
  query_json: Record<string, unknown>;
  viz: 'table' | 'kpi_tile' | 'rag_list';
  shared_staff_ids: number[];
}

export async function fetchIwrSavedReports(token: string): Promise<{ items: IwrSavedReport[] }> {
  return iwrFetch(token, '/api/crm/iwr/saved-reports');
}

export async function createIwrSavedReport(
  token: string,
  body: {
    name_vi: string;
    query_json?: Record<string, unknown>;
    viz?: 'table' | 'kpi_tile' | 'rag_list';
  },
): Promise<IwrSavedReport> {
  return iwrFetch(token, '/api/crm/iwr/saved-reports', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function runIwrSavedReport(
  token: string,
  id: string,
): Promise<{ rows: unknown[]; truncated: boolean }> {
  return iwrFetch(token, `/api/crm/iwr/saved-reports/${id}/run`, { method: 'POST', body: '{}' });
}

export interface IwrApprovalRow {
  id: string;
  report_id: string;
  kind: 'budget' | 'scope' | 'extension' | 'staffing' | 'other';
  requester_staff_id: number;
  approver_staff_id: number;
  status: 'pending' | 'approved' | 'rejected';
  payload_json: Record<string, unknown>;
  created_at: string;
}

export async function fetchIwrApprovals(token: string): Promise<{ items: IwrApprovalRow[] }> {
  return iwrFetch(token, '/api/crm/iwr/approvals');
}

export async function createIwrApproval(
  token: string,
  body: {
    report_id: string;
    kind: IwrApprovalRow['kind'];
    approver_staff_id: number;
    payload_json?: Record<string, unknown>;
  },
): Promise<IwrApprovalRow> {
  return iwrFetch(token, '/api/crm/iwr/approvals', { method: 'POST', body: JSON.stringify(body) });
}

export function iwrJsonExportUrl(id: string): string {
  return `${API_BASE}/api/crm/iwr/reports/${id}/export.json`;
}

export async function reopenIwrReport(
  token: string,
  id: string,
  reason: string,
): Promise<IwrReportDetail> {
  return iwrFetch(token, `/api/crm/iwr/reports/${id}/reopen`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function fetchIwrTemplateVersions(
  token: string,
  templateId: string,
): Promise<{ items: { id: string; version: string; effective_from: string }[] }> {
  return iwrFetch(token, `/api/crm/iwr/templates/${templateId}/versions`);
}

export async function fetchIwrTemplateFields(
  token: string,
  versionId: string,
): Promise<{ items: { field_key: string; label_vi: string; sensitivity: string }[] }> {
  return iwrFetch(token, `/api/crm/iwr/templates/versions/${versionId}/fields`);
}

export async function fetchIwrAiStatus(token: string): Promise<{ enabled: boolean }> {
  return iwrFetch(token, '/api/crm/iwr/ai/status');
}

export async function summarizeIwrReport(
  token: string,
  reportId: string,
): Promise<{ text: string; citations: string[] }> {
  return iwrFetch(token, '/api/crm/iwr/ai/summaries', {
    method: 'POST',
    body: JSON.stringify({ report_id: reportId }),
  });
}

export async function fetchIwrAiInsights(
  token: string,
  reportId: string,
): Promise<{ quality: string[]; risks: string[]; citations: string[] }> {
  return iwrFetch(token, '/api/crm/iwr/ai/insights', {
    method: 'POST',
    body: JSON.stringify({ report_id: reportId }),
  });
}

export async function requestIwrExternalShare(
  token: string,
  body: { report_id: string; email: string; approver_staff_id: number },
): Promise<{ approval_id: string }> {
  return iwrFetch(token, '/api/crm/iwr/external/shares/request', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function formatIwrWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  } catch {
    return iso;
  }
}

export function iwrDerivedLabel(derived: IwrTeamNode['derived']): string {
  const map: Record<IwrTeamNode['derived'], string> = {
    missing: 'Chưa nộp',
    draft: 'Nháp',
    submitted: 'Đã gửi',
    late: 'Nộp muộn',
    waived: 'Miễn nộp',
    acked: 'Đã xác nhận',
  };
  return map[derived];
}
