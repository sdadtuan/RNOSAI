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
  labels?: string[];
  notes?: string;
  email?: string;
};

export type LeadTableFilters = {
  query: string;
  pageId: string;
  source: string;
  status: string;
  assignee: string;
  from: string;
  to: string;
  tag: string;
};

export const EMPTY_LEAD_FILTERS: LeadTableFilters = {
  query: '',
  pageId: '',
  source: '',
  status: '',
  assignee: '',
  from: '',
  to: '',
  tag: '',
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
  campaign: 'Chiến dịch',
  campaign_name: 'Chiến dịch',
  campaign_id: 'Mã chiến dịch',
  adset: 'Nhóm quảng cáo',
  ad_set: 'Nhóm quảng cáo',
  adset_name: 'Nhóm quảng cáo',
  ad_set_name: 'Nhóm quảng cáo',
  adset_id: 'Mã nhóm quảng cáo',
  ad_set_id: 'Mã nhóm quảng cáo',
  ad: 'Quảng cáo',
  ad_name: 'Quảng cáo',
  ad_id: 'Mã quảng cáo',
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

export function filterLeadRows<T extends LeadTableRow>(
  rows: T[],
  filters: LeadTableFilters,
  pageName: Map<string, string>,
): T[] {
  const needle = filters.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.pageId && row.page_id !== filters.pageId) return false;
    if (filters.source && leadSource(row) !== filters.source) return false;
    if (filters.status && row.status !== filters.status) return false;
    if (filters.assignee === 'unassigned' && row.assignee_user_id) return false;
    if (filters.assignee && filters.assignee !== 'unassigned' && row.assignee_user_id !== filters.assignee) {
      return false;
    }
    if (filters.tag) {
      const labels = row.labels ?? [];
      if (!labels.includes(filters.tag)) return false;
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
      (row.labels ?? []).join(' '),
    ]
      .join(' ')
      .toLowerCase();
    return blob.includes(needle);
  });
}

export function sortLeadsByRecent<T extends LeadTableRow>(rows: T[]): T[] {
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


export const LEAD_STATUS_ORDER = ['waiting_receive', 'received', 'caring', 'purchased'] as const;
export type LeadStatusId = (typeof LEAD_STATUS_ORDER)[number];

/** Kanban drop maps ONLY onto existing CRM PTT lead actions (receive / care). No new transitions. */
export type LeadKanbanDrop =
  | { ok: true; action: 'receive' | 'care' }
  | { ok: false; reason: 'same' | 'already_purchased' | 'invalid_transition' };

export function leadKanbanDropAction(fromStatus: string, toStatus: string): LeadKanbanDrop {
  if (!toStatus || fromStatus === toStatus) return { ok: false, reason: 'same' };
  if (fromStatus === 'purchased') return { ok: false, reason: 'already_purchased' };
  // "Nhận lead" — only from waiting_receive, same as postPortalCase(..., 'receive')
  if (toStatus === 'received' && fromStatus === 'waiting_receive') return { ok: true, action: 'receive' };
  // "Đang chăm sóc" — any non-purchased, non-caring, same as postPortalCase(..., 'care')
  if (toStatus === 'caring' && fromStatus !== 'caring' && fromStatus !== 'purchased') {
    return { ok: true, action: 'care' };
  }
  // purchased column is display-only: "Mua hàng" is set by the existing purchase path, not by drag
  return { ok: false, reason: 'invalid_transition' };
}

export const LEAD_TAG_PALETTE = [
  '#0d9488',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#ef4444',
  '#10b981',
  '#64748b',
  '#f97316',
  '#06b6d4',
];

export function leadTagColor(name: string, catalog?: Array<{ name: string; color: string }>): string {
  const hit = (catalog ?? []).find((item) => item.name === name);
  const raw = String(hit?.color || '').trim();
  if (raw) return raw.startsWith('#') ? raw : `#${raw}`;
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return LEAD_TAG_PALETTE[hash % LEAD_TAG_PALETTE.length];
}

export function uniqueLeadTags(rows: Array<{ labels?: string[] }>): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    for (const label of row.labels ?? []) {
      const name = String(label || '').trim();
      if (name) set.add(name);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'vi'));
}

export function formatLeadPhoneDigits(raw: string): string {
  return formatLeadPhoneDisplay(raw).replace(/[^\d]/g, '');
}

export function findLinkedConversation<T extends { id: string; page_id?: string; title?: string; snippet?: string; phone?: string; order?: { phone?: string } }>(
  lead: T & { answers?: Array<{ name: string; value: string }>; snippet?: string },
  messages: T[],
): T | null {
  if (!messages.length) return null;
  const phone = formatLeadPhoneDigits(String(lead.order?.phone || lead.phone || '').trim());
  const answerIds = (lead.answers ?? [])
    .map((item) => String(item.value || ''))
    .join(' ');
  const blob = `${lead.snippet || ''} ${answerIds}`;
  for (const msg of messages) {
    if (blob.includes(msg.id)) return msg;
    const inboxToken = `inbox:${msg.id}`;
    if (blob.includes(inboxToken)) return msg;
  }
  if (phone) {
    const samePage = messages.filter((msg) => !lead.page_id || msg.page_id === lead.page_id);
    const pool = samePage.length ? samePage : messages;
    for (const msg of pool) {
      const other = formatLeadPhoneDigits(String(msg.order?.phone || msg.phone || '').trim());
      if (other && other === phone) return msg;
    }
  }
  const title = String(lead.title || '').trim().toLowerCase();
  if (title) {
    const hits = messages.filter((msg) => String(msg.title || '').trim().toLowerCase() === title);
    if (hits.length === 1) return hits[0];
  }
  return null;
}

export function findLinkedCommentHint(lead: LeadTableRow): { commentId: string; label: string } | null {
  const answers = lead.answers ?? [];
  for (const item of answers) {
    const name = String(item.name || '').toLowerCase();
    const value = String(item.value || '').trim();
    if (!value) continue;
    if (name.includes('comment') || value.startsWith('comment:')) {
      const id = value.replace(/^comment:/, '');
      if (id) return { commentId: id, label: value };
    }
  }
  const snippet = String(lead.snippet || '');
  const m = snippet.match(/comment:([A-Za-z0-9_]+)/);
  if (m) return { commentId: m[1], label: m[0] };
  return null;
}
