export type B2bLeadEligibleStaff = {
  id: number;
  name: string;
  email?: string | null;
  internal_code?: string | null;
  job_title?: string | null;
};

export function b2bStaffPickerLabel(row: B2bLeadEligibleStaff): string {
  const parts = [row.name.trim() || `NV #${row.id}`];
  const code = String(row.internal_code ?? '').trim();
  const email = String(row.email ?? '').trim();
  if (code) parts.push(code);
  if (email) parts.push(email);
  return parts.join(' · ');
}

export function b2bStaffPickerOptions(
  eligible: B2bLeadEligibleStaff[],
  assignedIds: Array<number | string>,
): Array<{ value: string; label: string }> {
  const byId = new Map<string, B2bLeadEligibleStaff>();
  for (const row of eligible) {
    byId.set(String(row.id), row);
  }
  for (const raw of assignedIds) {
    const id = String(raw).trim();
    if (!id || byId.has(id)) continue;
    byId.set(id, { id: Number(id), name: `NV #${id}` });
  }
  return [...byId.values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    .map((row) => ({ value: String(row.id), label: b2bStaffPickerLabel(row) }));
}
