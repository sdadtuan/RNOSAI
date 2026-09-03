import type { IwrInboxBox, IwrReportRow, IwrReportStatus } from '@/lib/crm/iwr-api';
import { iwrB2bProjectCatalog, iwrProjectLabelFromMeta, resolveIwrB2bProjectId } from './iwr-b2b-project';
import type { IwrB2bProjectCatalog } from './iwr-b2b-project';
import { iwrIsoWeekLabel } from './iwr-format';
import { iwrItemText, parseIwrItemMeta } from './iwr-item-meta';

export type IwrInboxKind = 'all' | 'daily' | 'weekly' | 'project';
export type IwrInboxPeriod = 'week' | 'month' | 'all';
export type IwrInboxSort = 'newest' | 'oldest' | 'rag';
export type IwrInboxLabel = 'risk_customer' | 'wait_customer' | 'bod' | 'priority';

export const INBOX_FOLDERS: { id: IwrInboxBox; label: string }[] = [
  { id: 'action', label: 'Cần xử lý' },
  { id: 'unread', label: 'Chưa đọc' },
  { id: 'inbox', label: 'Đã nhận' },
  { id: 'sent', label: 'Đã gửi' },
  { id: 'draft', label: 'Nháp' },
  { id: 'waiting', label: 'Đang chờ phản hồi' },
  { id: 'needs_changes', label: 'Cần bổ sung' },
  { id: 'blockers', label: 'Blocker / Rủi ro' },
  { id: 'approvals', label: 'Yêu cầu phê duyệt' },
  { id: 'archived', label: 'Lưu trữ' },
];

export const INBOX_COUNT_BOXES: IwrInboxBox[] = [
  'action',
  'unread',
  'draft',
  'waiting',
  'needs_changes',
  'blockers',
  'approvals',
];

export const INBOX_KINDS: { id: IwrInboxKind; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'daily', label: 'Báo cáo ngày' },
  { id: 'weekly', label: 'Báo cáo tuần' },
  { id: 'project', label: 'Dự án' },
];

export const INBOX_LABELS: { id: IwrInboxLabel; label: string; tone: string }[] = [
  { id: 'risk_customer', label: 'Khách hàng rủi ro', tone: 'red' },
  { id: 'wait_customer', label: 'Chờ khách hàng', tone: 'amber' },
  { id: 'bod', label: 'Cần BOD duyệt', tone: 'blue' },
  { id: 'priority', label: 'Ưu tiên cao', tone: 'purple' },
];

const PREVIEW_KEYS = ['done', 'highlights', 'blocked', 'wip', 'next', 'next_week', 'notes', 'approvals'] as const;

function sectionBody(row: IwrReportRow, key: string): string {
  const section = row.sections_json?.[key];
  const body = typeof section?.body === 'string' ? section.body.trim() : '';
  if (body) return body;
  const items = Array.isArray(section?.items) ? section.items : [];
  for (const raw of items) {
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
    if (raw && typeof raw === 'object') {
      const rec = raw as { title?: string; body?: string };
      const text = iwrItemText(parseIwrItemMeta(rec.body)) || String(rec.title ?? '').trim();
      if (text) return text;
    }
  }
  return '';
}

export function iwrInboxPreview(row: IwrReportRow, max = 140): string {
  for (const key of PREVIEW_KEYS) {
    const text = sectionBody(row, key).split('\n').map((l) => l.replace(/^[-*•]\s*/, '').trim()).find(Boolean);
    if (text) return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }
  return '';
}

export function iwrInboxProject(row: IwrReportRow, catalog?: IwrB2bProjectCatalog): string {
  for (const key of Object.keys(row.sections_json ?? {})) {
    const section = row.sections_json[key];
    const items = Array.isArray(section?.items) ? section.items : [];
    for (const raw of items) {
      if (!raw || typeof raw !== 'object') continue;
      const rec = raw as { title?: string; body?: string; project?: string };
      const meta = parseIwrItemMeta(rec.body);
      const label = iwrProjectLabelFromMeta(meta, catalog);
      if (label) return label;
    }
  }
  return '';
}

export function iwrInboxProjectIds(row: IwrReportRow, catalog: IwrB2bProjectCatalog = new Map()): string[] {
  const ids = new Set<string>();
  for (const key of Object.keys(row.sections_json ?? {})) {
    const section = row.sections_json[key];
    const items = Array.isArray(section?.items) ? section.items : [];
    for (const raw of items) {
      if (!raw || typeof raw !== 'object') continue;
      const rec = raw as { title?: string; body?: string; project?: string };
      const meta = parseIwrItemMeta(rec.body);
      const projectId = resolveIwrB2bProjectId(meta, catalog);
      if (projectId) ids.add(projectId);
    }
  }
  return Array.from(ids);
}

export function iwrInboxMatchesProject(row: IwrReportRow, projectId: string, catalog: IwrB2bProjectCatalog): boolean {
  if (!projectId) return true;
  return iwrInboxProjectIds(row, catalog).includes(projectId);
}

export function iwrInboxHasApprovals(row: IwrReportRow): boolean {
  return Boolean(sectionBody(row, 'approvals'));
}

export function iwrInboxClock(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return '—';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return iso;
  const vnNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const vnThen = new Date(t.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const sameDay =
    vnNow.getFullYear() === vnThen.getFullYear() &&
    vnNow.getMonth() === vnThen.getMonth() &&
    vnNow.getDate() === vnThen.getDate();
  const time = vnThen.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (sameDay) return time;
  const yday = new Date(vnNow);
  yday.setDate(vnNow.getDate() - 1);
  if (
    yday.getFullYear() === vnThen.getFullYear() &&
    yday.getMonth() === vnThen.getMonth() &&
    yday.getDate() === vnThen.getDate()
  ) {
    return 'Hôm qua';
  }
  return `${String(vnThen.getDate()).padStart(2, '0')}/${String(vnThen.getMonth() + 1).padStart(2, '0')}`;
}

export function iwrInboxMatchesKind(row: IwrReportRow, kind: IwrInboxKind): boolean {
  if (kind === 'all') return true;
  if (kind === 'daily') return row.template_code === 'daily_work';
  if (kind === 'weekly') return row.template_code === 'weekly_work';
  return row.template_code === 'monthly_work' || Boolean(iwrInboxProject(row));
}

export function iwrInboxMatchesPeriod(row: IwrReportRow, period: IwrInboxPeriod, now = new Date()): boolean {
  if (period === 'all') return true;
  const stamp = (row.submitted_at || row.period_start || '').slice(0, 10);
  if (!stamp) return true;
  if (period === 'week') {
    const week = iwrIsoWeekLabel(now);
    return stamp >= week.start && stamp <= week.end;
  }
  const vn = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const ym = `${vn.getFullYear()}-${String(vn.getMonth() + 1).padStart(2, '0')}`;
  return stamp.startsWith(ym);
}

export function iwrInboxMatchesLabel(row: IwrReportRow, label: IwrInboxLabel | null): boolean {
  if (!label) return true;
  const preview = `${iwrInboxPreview(row, 400)} ${sectionBody(row, 'blocked')}`.toLowerCase();
  if (label === 'risk_customer') return row.rag === 'red' || /khách.*rủi|rủi ro.*khách/.test(preview);
  if (label === 'wait_customer') return /chờ khách|waiting/.test(preview);
  if (label === 'bod') return iwrInboxHasApprovals(row);
  return row.is_late || row.rag === 'red';
}

const RAG_RANK: Record<string, number> = { red: 0, yellow: 1, green: 2, gray: 3 };

export function iwrInboxSortRows(rows: IwrReportRow[], sort: IwrInboxSort): IwrReportRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (sort === 'rag') {
      const da = RAG_RANK[a.rag ?? 'gray'] ?? 4;
      const db = RAG_RANK[b.rag ?? 'gray'] ?? 4;
      if (da !== db) return da - db;
    }
    const ta = new Date(a.submitted_at || a.due_at || 0).getTime();
    const tb = new Date(b.submitted_at || b.due_at || 0).getTime();
    return sort === 'oldest' ? ta - tb : tb - ta;
  });
  return copy;
}

export function iwrInboxStatusBadge(status: IwrReportStatus, rag: IwrReportRow['rag']): { text: string; tone: string } | null {
  if (status === 'changes_requested') return { text: 'Cần bổ sung', tone: 'blue' };
  if (rag === 'red') return { text: 'Rủi ro cao', tone: 'red' };
  if (rag === 'yellow') return { text: 'Vàng', tone: 'amber' };
  if (rag === 'green') return { text: 'Xanh', tone: 'green' };
  if (status === 'submitted' || status === 'supplemented') return { text: 'Cần duyệt', tone: 'blue' };
  return null;
}
