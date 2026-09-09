export type PmViewerRole =
  | 'owner' | 'lead' | 'dept_head' | 'finance' | 'hr'
  | 'account' | 'data_owner' | 'auditor' | 'client_viewer';

const CLIENT_FIELDS = ['target', 'actual', 'disclaimer'] as const;
const FINANCE_HIDE = ['hr_note', 'reviewer_comment'];
const HR_HIDE = ['margin', 'agency_fee', 'reviewer_comment'];

export function filterFieldsForRole<T extends Record<string, unknown>>(
  row: T,
  role: PmViewerRole,
): Partial<T> {
  if (role === 'auditor' || role === 'data_owner' || role === 'dept_head') return { ...row };
  if (role === 'client_viewer' || role === 'account') {
    const out: Record<string, unknown> = {};
    for (const key of CLIENT_FIELDS) if (key in row) out[key] = row[key];
    return out as Partial<T>;
  }
  const hide = role === 'finance' ? FINANCE_HIDE : role === 'hr' ? HR_HIDE : [];
  const out = { ...row };
  for (const key of hide) delete (out as Record<string, unknown>)[key];
  return out;
}
