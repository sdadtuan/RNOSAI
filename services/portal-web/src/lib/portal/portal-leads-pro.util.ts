/**
 * Lead page (pro redesign) — pure display helpers. No data rules live here:
 * filtering / KPIs / kanban transitions stay in portal-leads-table.util.ts.
 */
import {
  formatLeadPhoneDisplay,
  leadEmail,
  leadFormLabel,
  leadInteractedAt,
  leadPhone,
  leadSource,
  type LeadTableRow,
} from '@/lib/portal/portal-leads-table.util';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const LEAD_STATUS_RANK: Record<string, number> = {
  waiting_receive: 0,
  received: 1,
  caring: 2,
  purchased: 3,
};

/** Short Vietnamese duration: "5 phút", "3 giờ", "2 ngày". */
export function formatShortDuration(ms: number): string {
  const abs = Math.max(0, Math.abs(ms));
  if (abs < MINUTE) return '1 phút';
  if (abs < HOUR) return `${Math.floor(abs / MINUTE)} phút`;
  if (abs < DAY) return `${Math.floor(abs / HOUR)} giờ`;
  if (abs < 30 * DAY) return `${Math.floor(abs / DAY)} ngày`;
  if (abs < 365 * DAY) return `${Math.floor(abs / (30 * DAY))} tháng`;
  return `${Math.floor(abs / (365 * DAY))} năm`;
}

/** "vừa xong" / "5 phút trước" … relative to now. Empty when no date. */
export function leadAgeLabel(iso: string | undefined, now = Date.now()): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = now - t;
  if (diff < MINUTE) return 'vừa xong';
  return `${formatShortDuration(diff)} trước`;
}

export type LeadSla = { tone: 'over' | 'soon' | ''; label: string; title: string };

const NO_SLA: LeadSla = { tone: '', label: '', title: '' };

/**
 * SLA badge from the existing due dates:
 * waiting_receive → receive_due_at, received → care_due_at. Display only.
 */
export function leadSla(
  row: { status: string; receive_due_at?: string; care_due_at?: string },
  now = Date.now(),
): LeadSla {
  const due = row.status === 'waiting_receive' ? row.receive_due_at : row.status === 'received' ? row.care_due_at : '';
  if (!due) return NO_SLA;
  const t = new Date(due).getTime();
  if (Number.isNaN(t)) return NO_SLA;
  const kind = row.status === 'waiting_receive' ? 'nhận lead' : 'chăm sóc';
  const diff = t - now;
  if (diff < 0) return { tone: 'over', label: `Trễ ${formatShortDuration(-diff)}`, title: `Quá hạn ${kind} ${formatShortDuration(-diff)}` };
  if (diff <= 30 * MINUTE) return { tone: 'soon', label: `Còn ${formatShortDuration(diff)}`, title: `Sắp hết hạn ${kind}` };
  return NO_SLA;
}

export function leadInitials(name: string): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'L';
  const letters = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0];
  return letters.toUpperCase();
}

const AVATAR_TONES = ['#17692f', '#2563eb', '#7c3aed', '#db2777', '#d97706', '#0891b2', '#4d7c0f', '#9333ea', '#c2410c', '#0f766e'];

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/** Stable color for an avatar / Page dot. */
export function toneFor(seed: string): string {
  return AVATAR_TONES[hash(String(seed || 'x')) % AVATAR_TONES.length];
}

/** Display name for a staff member: real name, else email local part. */
export function staffLabel(id: string | null | undefined, email: string | undefined, names: Record<string, string>): string {
  if (!id && !email) return '';
  const name = id ? names[id] : '';
  if (name) return name;
  const raw = String(email || id || '').trim();
  return raw.includes('@') ? raw.split('@')[0] : raw;
}

export type LeadSortKey = 'recent' | 'name' | 'status';

export function sortLeadRows<T extends LeadTableRow>(rows: T[], key: LeadSortKey, dir: 'asc' | 'desc'): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    let cmp = 0;
    if (key === 'name') cmp = String(a.title || '').localeCompare(String(b.title || ''), 'vi');
    else if (key === 'status') cmp = (LEAD_STATUS_RANK[a.status] ?? 9) - (LEAD_STATUS_RANK[b.status] ?? 9);
    if (cmp === 0 || key === 'recent') {
      const left = new Date(leadInteractedAt(a)).getTime() || 0;
      const right = new Date(leadInteractedAt(b)).getTime() || 0;
      const byTime = left - right;
      return key === 'recent' ? sign * byTime : -byTime;
    }
    return sign * cmp;
  });
}

/** Compact page list for pagination: 1 … 4 5 6 … 12 */
export function pagerWindow(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: Array<number | '…'> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push('…');
  for (let i = start; i <= end; i += 1) out.push(i);
  if (end < total - 1) out.push('…');
  out.push(total);
  return out;
}

function csvCell(value: string): string {
  const v = String(value ?? '');
  return /[",\n\r;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function leadsToCsv<T extends LeadTableRow>(
  rows: T[],
  pageName: Map<string, string>,
  statusLabel: Record<string, string>,
  owner: (row: T) => string,
): string {
  const head = ['Tên', 'SĐT', 'Email', 'Page', 'Biểu mẫu', 'Chiến dịch', 'Trạng thái', 'Thẻ', 'Phụ trách', 'Thời gian'];
  const lines = rows.map((row) =>
    [
      row.title || '',
      formatLeadPhoneDisplay(leadPhone(row)),
      leadEmail(row),
      pageName.get(row.page_id) || row.page_id,
      leadFormLabel(row),
      leadSource(row),
      statusLabel[row.status] || row.status,
      (row.labels ?? []).join(', '),
      owner(row),
      leadInteractedAt(row),
    ]
      .map(csvCell)
      .join(','),
  );
  return '\ufeff' + [head.join(','), ...lines].join('\r\n');
}
