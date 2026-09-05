export function amDelegationUntilLabel(delegatedUntil: string | null | undefined): string | null {
  const day = String(delegatedUntil ?? '').trim();
  return day ? `ủy quyền đến ${day}` : null;
}

export type AmDelegationRosterSource = {
  id: string;
  email?: string | null;
  display_name?: string | null;
  crm_staff_id?: number | null;
};

export function amDelegationCrmStaffByEmail(
  staff: Array<{ id: number; email?: string | null }>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of staff) {
    const email = String(row.email ?? '').trim().toLowerCase();
    const id = Number(row.id);
    if (!email || !Number.isInteger(id) || id <= 0) continue;
    map.set(email, id);
  }
  return map;
}

export function amDelegationCrmStaffId(
  row: AmDelegationRosterSource,
  crmStaffByEmail?: ReadonlyMap<string, number>,
): number | null {
  const fromField = Number(row.crm_staff_id);
  if (Number.isInteger(fromField) && fromField > 0) return fromField;
  const raw = String(row.id ?? '').trim();
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    if (Number.isInteger(n) && n > 0) return n;
  }
  const email = String(row.email ?? '').trim().toLowerCase();
  if (email && crmStaffByEmail) {
    const mapped = crmStaffByEmail.get(email);
    if (mapped != null && Number.isInteger(mapped) && mapped > 0) return mapped;
  }
  return null;
}

export function amDelegationSelectOptions(
  roster: AmDelegationRosterSource[],
  crmStaffByEmail?: ReadonlyMap<string, number>,
): Array<{ crm_staff_id: number; label: string; email: string }> {
  const seen = new Set<number>();
  const out: Array<{ crm_staff_id: number; label: string; email: string }> = [];
  for (const row of roster) {
    const id = amDelegationCrmStaffId(row, crmStaffByEmail);
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    const email = String(row.email ?? '');
    out.push({
      crm_staff_id: id,
      label: String(row.display_name || email || id),
      email,
    });
  }
  return out;
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
