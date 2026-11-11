/** MKL implementation case after lead enters Triển khai. */

export const IMPLEMENTATION_ACCEPT_MINUTES = 15;

export type ImplementationHandoffStatus = '' | 'pending' | 'claimed';

export function normalizeImplementationHandoffStatus(raw: unknown): ImplementationHandoffStatus {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'pending' || s === 'claimed') return s;
  return '';
}

export interface ImplementationHandoffSource {
  implementation_handoff_status: string;
  implementation_owner_staff_id: number | null;
  implementation_owner_name: string;
  implementation_accept_due_at: string;
  implementation_claimed_at: string;
}

export interface ImplementationHandoffView {
  status: ImplementationHandoffStatus;
  owner_staff_id: number | null;
  owner_name: string;
  accept_due_at: string;
  claimed_at: string;
  timer_overdue: boolean;
  step_label: string;
  expected_role: 'Marketing Leader' | '';
}

export function buildImplementationHandoffView(
  row: ImplementationHandoffSource,
  now: Date,
): ImplementationHandoffView | null {
  const status = normalizeImplementationHandoffStatus(row.implementation_handoff_status);
  if (!status) return null;
  const dueRaw = String(row.implementation_accept_due_at ?? '').trim();
  const dueMs = dueRaw ? Date.parse(dueRaw) : NaN;
  const overdue = status === 'pending' && Number.isFinite(dueMs) && now.getTime() > dueMs;
  return {
    status,
    owner_staff_id:
      row.implementation_owner_staff_id != null && row.implementation_owner_staff_id > 0
        ? row.implementation_owner_staff_id
        : null,
    owner_name: String(row.implementation_owner_name ?? '').trim(),
    accept_due_at: dueRaw,
    claimed_at: String(row.implementation_claimed_at ?? '').trim(),
    timer_overdue: overdue,
    step_label: status === 'pending' ? 'Chờ MKL nhận case Triển khai' : 'Đang Triển khai',
    expected_role: status === 'pending' ? 'Marketing Leader' : '',
  };
}
