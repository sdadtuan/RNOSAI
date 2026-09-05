export function amDelegationUntilLabel(delegatedUntil: string | null | undefined): string | null {
  const day = String(delegatedUntil ?? '').trim();
  return day ? `ủy quyền đến ${day}` : null;
}

export type AmDelegationFormError =
  | 'delegation_self'
  | 'ends_before_starts'
  | 'to_staff_id_required'
  | 'dates_required';

export function amDelegationFormError(input: {
  from_staff_id?: number | null;
  to_staff_id?: number | null;
  starts_on?: string;
  ends_on?: string;
}): AmDelegationFormError | null {
  const to = Number(input.to_staff_id);
  if (!Number.isInteger(to) || to <= 0) return 'to_staff_id_required';
  const starts = String(input.starts_on ?? '').trim();
  const ends = String(input.ends_on ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(starts) || !/^\d{4}-\d{2}-\d{2}$/.test(ends)) return 'dates_required';
  if (ends < starts) return 'ends_before_starts';
  const from = input.from_staff_id == null || input.from_staff_id === 0 ? null : Number(input.from_staff_id);
  if (from != null && from === to) return 'delegation_self';
  return null;
}

export function amDelegationErrorCopy(code: string): string {
  if (code === 'delegation_self') return 'Không ủy quyền cho chính mình.';
  if (code === 'ends_before_starts') return 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.';
  if (code === 'to_staff_id_required') return 'Chọn người nhận ủy quyền.';
  if (code === 'dates_required') return 'Cần ngày bắt đầu và ngày kết thúc.';
  return code;
}
