/** Raw lead AE care assignment — status + 3-day revoke rule. */

export const RAW_LEAD_CARE_STATUSES = [
  'awaiting_assign',
  'assigned',
  'revoked',
] as const;

export type RawLeadCareStatus = (typeof RAW_LEAD_CARE_STATUSES)[number];

export const RAW_LEAD_CARE_CONTACT_STATUSES = [
  'pending',
  'contacted',
  'unreachable',
] as const;

export type RawLeadCareContactStatus =
  (typeof RAW_LEAD_CARE_CONTACT_STATUSES)[number];

export const CARE_NO_UPDATE_REVOKE_DAYS = 3;

export function normalizeCareStatus(raw: unknown): RawLeadCareStatus {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'assigned') return 'assigned';
  if (s === 'revoked') return 'revoked';
  return 'awaiting_assign';
}

export function normalizeCareContactStatus(
  raw: unknown,
): RawLeadCareContactStatus {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'contacted') return 'contacted';
  if (s === 'unreachable') return 'unreachable';
  return 'pending';
}

export function shouldRevokeAssignedCare(input: {
  care_status: string | null | undefined;
  assigned_at: Date | string | null | undefined;
  care_contact_status: string | null | undefined;
  now?: Date;
  revokeAfterDays?: number;
}): boolean {
  if (normalizeCareStatus(input.care_status) !== 'assigned') return false;
  if (normalizeCareContactStatus(input.care_contact_status) !== 'pending') {
    return false;
  }
  if (input.assigned_at == null || input.assigned_at === '') return false;
  const assigned =
    input.assigned_at instanceof Date
      ? input.assigned_at
      : new Date(String(input.assigned_at));
  if (Number.isNaN(assigned.getTime())) return false;
  const days = input.revokeAfterDays ?? CARE_NO_UPDATE_REVOKE_DAYS;
  const now = input.now ?? new Date();
  return now.getTime() - assigned.getTime() >= days * 24 * 3600_000;
}

export function assertAssignableForCare(input: {
  care_status?: string | null;
  crm_lead_id?: number | null;
  status?: string | null;
}): { ok: true } | { ok: false; error: string } {
  if (input.crm_lead_id != null) return { ok: false, error: 'already_in_crm' };
  if (String(input.status ?? '') === 'pushed') {
    return { ok: false, error: 'already_pushed' };
  }
  const care = normalizeCareStatus(input.care_status);
  if (care === 'assigned') return { ok: false, error: 'already_assigned' };
  return { ok: true };
}
