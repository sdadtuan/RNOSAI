export type AmWorkView = 'list' | 'board' | 'week';
export type AmWorkInbox = 'me' | 'team' | 'unassigned';
export type AmWorkBoardColumnId = 'new' | 'in_progress' | 'waiting_client' | 'resolved';

export type AmWorkBoardColumn = {
  id: AmWorkBoardColumnId;
  label: string;
  statuses: string[];
};

export const AM_WORK_BOARD_COLUMNS: AmWorkBoardColumn[] = [
  { id: 'new', label: 'New', statuses: ['new'] },
  { id: 'in_progress', label: 'In Progress', statuses: ['in_progress', 'waiting_internal'] },
  { id: 'waiting_client', label: 'Waiting Client', statuses: ['waiting_client'] },
  { id: 'resolved', label: 'Resolved', statuses: ['resolved', 'closed'] },
];

export type AmTaskOverdueInput = {
  status: string;
  sla_paused?: boolean | null;
  sla_resolve_due_at?: string | null;
};

export function amTaskOverdue(row: AmTaskOverdueInput): boolean {
  if (row.status === 'waiting_client' && row.sla_paused === true) return false;
  if (!row.sla_resolve_due_at) return false;
  return Date.parse(row.sla_resolve_due_at) < Date.now();
}

export function parseAmWorkView(raw: string | null | undefined): AmWorkView {
  if (raw === 'board' || raw === 'week') return raw;
  return 'list';
}

export function parseAmWorkInbox(raw: string | null | undefined): AmWorkInbox {
  if (raw === 'team' || raw === 'unassigned') return raw;
  return 'me';
}

export function amWorkBoardColumn(status: string | null | undefined): AmWorkBoardColumnId {
  const hit = AM_WORK_BOARD_COLUMNS.find((col) => col.statuses.includes(status ?? ''));
  return hit?.id ?? 'new';
}

export function amWorkDash(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  return String(value);
}

export function amWorkSlaCopy(row: {
  status: string;
  sla_paused?: boolean | null;
  sla_clock?: number | 'paused' | null;
  overdue?: boolean;
  sla_resolve_due_at?: string | null;
}): { label: string; danger: boolean } {
  if (row.status === 'waiting_client' && row.sla_paused === true) {
    return { label: 'Paused', danger: false };
  }
  if (row.overdue || amTaskOverdue(row)) return { label: 'Breached', danger: true };
  if (row.sla_clock === 'paused') return { label: 'Paused', danger: false };
  if (typeof row.sla_clock === 'number') return { label: formatRemain(row.sla_clock), danger: false };
  return { label: '—', danger: false };
}

const ICT = 'Asia/Ho_Chi_Minh';
const DOW_LABEL = ['T2', 'T3', 'T4', 'T5', 'T6'];

function ictYmd(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ICT,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function amWorkDueYmd(dueAt: string | null | undefined): string | null {
  if (!dueAt) return null;
  const ms = Date.parse(dueAt);
  if (!Number.isFinite(ms)) return null;
  return ictYmd(new Date(ms));
}

export function amWorkWeekDays(now = new Date()): Array<{ ymd: string; label: string }> {
  const today = ictYmd(now);
  const [y, m, d] = today.split('-').map(Number);
  const noon = new Date(Date.UTC(y, m - 1, d, 12));
  const dow = noon.getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const days: Array<{ ymd: string; label: string }> = [];
  for (let i = 0; i < 5; i += 1) {
    const day = new Date(noon.getTime() + (mondayOffset + i) * 86_400_000);
    const ymd = day.toISOString().slice(0, 10);
    const [, mm, dd] = ymd.split('-');
    days.push({ ymd, label: `${DOW_LABEL[i]} ${dd}/${mm}` });
  }
  return days;
}

export function formatAmWorkWhen(value: string | null | undefined): string {
  if (!value) return '—';
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: ICT,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ms));
}

function formatRemain(ms: number): string {
  const abs = Math.abs(ms);
  const hours = Math.floor(abs / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  const sign = ms < 0 ? 'Quá ' : '';
  if (hours > 0 && minutes > 0) return `${sign}${hours}h ${minutes}m`;
  if (hours > 0) return `${sign}${hours}h`;
  return `${sign}${minutes}m`;
}
