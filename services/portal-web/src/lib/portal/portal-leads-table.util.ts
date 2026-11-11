export const LEAD_PAGE_SIZE = 20;

export type LeadTableRow = {
  id: string;
  title: string;
  page_id: string;
  status: string;
  assignee_user_id: string | null;
  assignee_email: string;
  customer_id: string | null;
  created_at: string;
  last_interaction_at?: string;
  snippet?: string;
  source?: string;
  phone?: string;
  answers?: Array<{ name: string; value: string }>;
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
  form_id?: string;
  order?: { phone?: string };
};

export type LeadTableFilters = {
  query: string;
  pageId: string;
  source: string;
  status: string;
  assignee: string;
  from: string;
  to: string;
};

export const EMPTY_LEAD_FILTERS: LeadTableFilters = {
  query: '',
  pageId: '',
  source: '',
  status: '',
  assignee: '',
  from: '',
  to: '',
};

export function leadPhone(row: LeadTableRow): string {
  return String(row.order?.phone || row.phone || '').trim();
}

export function formatLeadPhoneDisplay(raw: string): string {
  const original = String(raw ?? '').trim();
  if (!original) return '';
  const digits = original.replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (digits.startsWith('84') && digits.length >= 10) {
    const rest = digits.slice(2);
    return rest.startsWith('0') ? rest : '0' + rest;
  }
  return digits || original;
}

export function leadPhoneHref(raw: string): string {
  const display = formatLeadPhoneDisplay(raw);
  return display ? 'tel:' + display.replace(/[^\d+]/g, '') : '';
}

export function humanizeLeadFieldValue(raw: string): string {
  const original = String(raw ?? '').trim();
  if (!original) return '';
  return original.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}
export function leadEmail(row: LeadTableRow): string {
  const direct = String((row as LeadTableRow & { email?: string }).email || '').trim();
  if (direct) return direct;
  const hit = (row.answers ?? []).find((item) => {
    const name = String(item.name || '').trim().toLowerCase();
    return name === 'email' || name === 'e-mail' || name === 'your_email' || name === 'mail' || name === 'email_address';
  });
  return String(hit?.value || '').trim();
}

const FIELD_LABELS: Record<string, string> = {
  full_name: 'Họ tên',
  name: 'Họ tên',
  first_name: 'Tên',
  last_name: 'Họ',
  phone_number: 'Số điện thoại',
  phone: 'Số điện thoại',
  email: 'Email',
  inbox_url: 'Link inbox',
};

export function humanizeLeadFieldLabel(raw: string): string {
  const original = String(raw ?? '').trim();
  if (!original) return 'Trường';
  const collapsed = original.toLowerCase().replace(/\s+/g, '_');
  if (FIELD_LABELS[collapsed]) return FIELD_LABELS[collapsed];
  const spaced = original.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : 'Trường';
}

export function leadSource(row: LeadTableRow): string {
  return String(row.source || '').trim();
}

export function leadOccurredAt(row: LeadTableRow): string {
  return String(row.last_interaction_at || '').trim();
}

export function leadInteractedAt(row: LeadTableRow): string {
  return leadOccurredAt(row);
}

export function saigonDayOffset(now = new Date(), offsetDays = 0): string {
  const date = new Date(now.getTime() + offsetDays * 86_400_000);
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export function countOnSaigonDay<T extends { last_interaction_at?: string }>(rows: T[], dayKey: string): number {
  return rows.filter((row) => saigonDateKey(row.last_interaction_at || '') === dayKey).length;
}

export function saigonDateKey(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export function leadKpis(rows: LeadTableRow[], now = new Date()) {
  const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  return {
    total: rows.length,
    waiting: rows.filter((row) => row.status === 'waiting_receive').length,
    assigned: rows.filter((row) => Boolean(row.assignee_user_id)).length,
    converted: rows.filter((row) => Boolean(row.customer_id)).length,
    today: rows.filter((row) => saigonDateKey(leadOccurredAt(row)) === today).length,
  };
}

export function filterLeadRows(
  rows: LeadTableRow[],
  filters: LeadTableFilters,
  pageName: Map<string, string>,
): LeadTableRow[] {
  const needle = filters.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.pageId && row.page_id !== filters.pageId) return false;
    if (filters.source && leadSource(row) !== filters.source) return false;
    if (filters.status && row.status !== filters.status) return false;
    if (filters.assignee === 'unassigned' && row.assignee_user_id) return false;
    if (filters.assignee && filters.assignee !== 'unassigned' && row.assignee_user_id !== filters.assignee) {
      return false;
    }
    const day = saigonDateKey(leadInteractedAt(row));
    if (filters.from && day && day < filters.from) return false;
    if (filters.to && day && day > filters.to) return false;
    if (!needle) return true;
    const blob = [
      row.title,
      leadPhone(row),
      formatLeadPhoneDisplay(leadPhone(row)),
      leadEmail(row),
      leadSource(row),
      pageName.get(row.page_id) || row.page_id,
      row.assignee_email || '',
      row.snippet || '',
    ]
      .join(' ')
      .toLowerCase();
    return blob.includes(needle);
  });
}

export function sortLeadsByRecent(rows: LeadTableRow[]): LeadTableRow[] {
  return [...rows].sort((a, b) => {
    const left = new Date(leadInteractedAt(a)).getTime() || 0;
    const right = new Date(leadInteractedAt(b)).getTime() || 0;
    return right - left;
  });
}

export function paginateRows<T>(
  rows: T[],
  page: number,
  pageSize = LEAD_PAGE_SIZE,
): { items: T[]; page: number; pages: number; total: number } {
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safe = Math.min(Math.max(1, page), pages);
  const start = (safe - 1) * pageSize;
  return { items: rows.slice(start, start + pageSize), page: safe, pages, total };
}

export function uniqueLeadSources(rows: LeadTableRow[]): string[] {
  return [...new Set(rows.map((row) => leadSource(row)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
}
