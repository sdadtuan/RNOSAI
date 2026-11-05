export type AmWorkEscalationLevel = 'lead' | 'director' | 'executive';

export function amWorkItemBreached(row: {
  overdue?: boolean | null;
  sla_paused?: boolean | null;
}): boolean {
  return row.overdue === true && row.sla_paused !== true;
}

export function amWorkItemErrorCopy(code: string): string {
  if (code === 'reason_required') return 'Cần lý do khi chuyển chờ khách hàng.';
  if (code === 'summary_required') return 'Cần tóm tắt xử lý.';
  if (code === 'category_required') return 'Issue cần chọn resolution category.';
  if (code === 'invalid_level') return 'Cấp escalate không hợp lệ.';
  if (code === 'invalid_recipient_staff_id') return 'Cần người nhận hợp lệ.';
  if (code === 'not_found') return 'Không tìm thấy việc trong phạm vi của bạn.';
  if (code === 'invalid_task_id') return 'Mã việc không hợp lệ.';
  return code;
}

export function amWorkItemClockCopy(clock: number | 'paused' | null | undefined): string {
  if (clock === 'paused') return 'paused';
  if (typeof clock !== 'number' || !Number.isFinite(clock)) return '';
  const abs = Math.abs(clock);
  const hours = Math.floor(abs / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  if (hours > 0 && minutes > 0) return `${hours}h${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

export function amWorkSuggestedLevel(
  row: {
    created_at?: string | null;
    sla_first_due_at?: string | null;
    sla_resolve_due_at?: string | null;
    suggested_escalation_level?: AmWorkEscalationLevel | null;
  },
  now = Date.now(),
): AmWorkEscalationLevel | '' {
  if (row.suggested_escalation_level) return row.suggested_escalation_level;
  const startRaw = row.created_at || row.sla_first_due_at;
  const start = startRaw ? Date.parse(startRaw) : NaN;
  const end = row.sla_resolve_due_at ? Date.parse(row.sla_resolve_due_at) : NaN;
  if (!Number.isFinite(end)) return '';
  if (!Number.isFinite(start) || end <= start) return now >= end ? 'executive' : '';
  const used = ((now - start) / (end - start)) * 100;
  if (used >= 100) return 'executive';
  if (used >= 90) return 'director';
  if (used >= 70) return 'lead';
  return '';
}

export const AM_WORK_KIND_COPY: Record<string, string> = {
  task: 'Task',
  client_request: 'Yêu cầu khách',
  issue: 'Issue',
  escalation: 'Escalate',
  approval: 'Approval',
  milestone: 'Milestone',
};

export const AM_WORK_STATUS_COPY: Record<string, string> = {
  new: 'New',
  in_progress: 'In Progress',
  waiting_client: 'Waiting Client',
  waiting_internal: 'Waiting Internal',
  resolved: 'Resolved',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

export const AM_WORK_PRIORITY_COPY: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const AM_WORK_ESCALATE_LEVELS: Array<{ value: AmWorkEscalationLevel; label: string }> = [
  { value: 'lead', label: 'Team Lead' },
  { value: 'director', label: 'Account Director' },
  { value: 'executive', label: 'Executive' },
];
