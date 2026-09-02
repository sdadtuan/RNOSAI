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
export type IwrInboxBox = 'action' | 'unread' | 'inbox' | 'sent' | 'draft';
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

export interface IwrReportDetail extends IwrReportRow {
  recipients: IwrRecipientRow[];
  comments: IwrCommentRow[];
  versions: { version: string; status: string; created_at: string }[];
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
  body?: { late_reason?: string; cc_staff_ids?: number[] },
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
