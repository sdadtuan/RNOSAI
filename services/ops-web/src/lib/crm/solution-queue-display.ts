import type { SolutionQueueRow } from '@/lib/api';
import { intakeServiceLabel } from '@/lib/crm/intake-service-resolve';
import { discoveryServiceLabel } from '@/lib/crm/sales-discovery';

const STAGE_LABEL: Record<string, string> = {
  lead: 'Mới',
  consult: 'Tư vấn',
  proposal: 'Đề xuất',
};

export type SolutionQueueBadge = {
  label: string;
  tone: 'amber' | 'green' | 'blue' | 'rose' | 'slate';
  detail: string;
};

export function solutionQueueServiceName(slug: string | null | undefined): string {
  const raw = String(slug ?? '').trim();
  if (!raw) return '—';
  const discovered = discoveryServiceLabel(raw);
  if (discovered && discovered !== raw) return discovered;
  const intake = intakeServiceLabel(raw);
  if (intake && intake !== raw) return intake;
  return discovered || '—';
}

export function solutionQueueShowStage(rows: Array<Pick<SolutionQueueRow, 'presales_stage'>>): boolean {
  return rows.some((row) => {
    const stage = String(row.presales_stage ?? '').trim();
    return Boolean(stage) && stage !== 'consult';
  });
}

export function solutionQueueStageLabel(stage: string | null | undefined): string {
  const raw = String(stage ?? '').trim();
  if (!raw || raw === 'consult') return '';
  return STAGE_LABEL[raw] || raw;
}

export function solutionQueueOwners(row: Pick<SolutionQueueRow, 'owner_name' | 'solution_owner_name'>): string[] {
  const lines: string[] = [];
  const sales = String(row.owner_name ?? '').trim();
  const am = String(row.solution_owner_name ?? '').trim();
  if (sales) lines.push(`Sales: ${sales}`);
  if (am) lines.push(`AM: ${am}`);
  return lines;
}

export function solutionQueueStatus(
  row: Pick<SolutionQueueRow, 'queue_kind' | 'handoff_status' | 'solution_owner_name'>,
): SolutionQueueBadge {
  if (row.queue_kind === 'am_rework' || row.handoff_status === 'returned') {
    return { label: 'Trả lại', tone: 'rose', detail: '' };
  }
  if (row.handoff_status === 'released') {
    return { label: 'Đã nộp', tone: 'blue', detail: '' };
  }
  if (row.handoff_status === 'with_solution') {
    return { label: 'Đã nhận', tone: 'green', detail: String(row.solution_owner_name ?? '').trim() };
  }
  if (row.handoff_status === 'pending' || !row.handoff_status) {
    return { label: 'Chờ nhận', tone: 'amber', detail: '' };
  }
  return { label: 'Đang làm', tone: 'slate', detail: String(row.solution_owner_name ?? '').trim() };
}

export function solutionQueueHandedAt(raw: string | null | undefined, now = new Date()): string {
  const text = String(raw ?? '').trim();
  if (!text) return '—';
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Saigon',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const year = get('year');
  const currentYear = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Saigon', year: 'numeric' }).format(now);
  const datePart = year && year !== currentYear ? `${get('day')}/${get('month')}/${year}` : `${get('day')}/${get('month')}`;
  return `${datePart} ${get('hour')}:${get('minute')}`;
}

const ACCEPT_WARN_MS = 3 * 60_000;
const WORK_WARN_MS = 48 * 60_000;

export function solutionQueueSlaTone(
  row: Pick<SolutionQueueRow, 'handoff_status' | 'solution_accept_due_at' | 'solution_due_at'>,
  now = new Date(),
): 'overdue' | 'near' | null {
  const pending = row.handoff_status === 'pending' || !row.handoff_status;
  const dueRaw = pending ? row.solution_accept_due_at : row.solution_due_at;
  const due = new Date(String(dueRaw ?? ''));
  if (!dueRaw || Number.isNaN(due.getTime())) return null;
  const remaining = due.getTime() - now.getTime();
  if (remaining <= 0) return 'overdue';
  if (remaining <= (pending ? ACCEPT_WARN_MS : WORK_WARN_MS)) return 'near';
  return null;
}