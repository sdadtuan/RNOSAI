export type AmFormContact = {
  id?: string;
  full_name: string;
  title?: string;
  role_committee?: string;
  is_primary: boolean;
  sentiment?: string;
  channel?: string;
  renewal_attitude?: string;
  email?: string;
  phone?: string;
};

export const AM_ACCOUNT_FORM_CTAS = ['Hủy', 'Lưu nháp', 'Lưu và tạo onboarding', 'Lưu'] as const;

export const AM_LEAVE_CONFIRM = 'Bạn có thay đổi chưa lưu. Rời trang?';

export function amAccountFormCtas(): string[] {
  return [...AM_ACCOUNT_FORM_CTAS];
}

export function amDraftStatus(): string {
  return 'pending_handover';
}

export function amOnboardingHref(agencyClientId: string): string {
  const id = encodeURIComponent(agencyClientId);
  return `/crm/account-management/onboarding?agency_client_id=${id}`;
}

export function hasAmPrimaryContact(contacts: Array<{ is_primary?: boolean; full_name?: string }>): boolean {
  return contacts.some((row) => Boolean(row.is_primary) && Boolean(String(row.full_name ?? '').trim()));
}

export function amPrimaryContactError(
  status: string,
  contacts: Array<{ is_primary?: boolean; full_name?: string }>,
): string {
  if (status === 'active' && !hasAmPrimaryContact(contacts)) return 'primary_contact_required';
  return '';
}

export function amConfirmLeave(
  dirty: boolean,
  confirmFn: (message: string) => boolean = (message) => window.confirm(message),
): boolean {
  if (!dirty) return true;
  return confirmFn(AM_LEAVE_CONFIRM);
}

export function amAccountEditHref(agencyClientId: string): string {
  return `/crm/account-management/clients/${encodeURIComponent(agencyClientId)}/edit`;
}

export function amAccountSaveId(agencyClientId?: string, createdId?: string): string {
  return String(agencyClientId || createdId || '').trim();
}

export function amGuardDirtyClick(
  ev: { preventDefault: () => void },
  dirty: boolean,
  confirmFn: (message: string) => boolean = (message) => window.confirm(message),
): boolean {
  if (!amConfirmLeave(dirty, confirmFn)) {
    ev.preventDefault();
    return false;
  }
  return true;
}

export function amOwnerStaffPatch(
  nextOwner: string,
  currentOwner: string | null | undefined,
  canAssign: boolean,
): { owner_staff_id: number | null } | { error: 'assign_required' } | Record<string, never> {
  const nextRaw = String(nextOwner ?? '').trim();
  const currentRaw = String(currentOwner ?? '').trim();
  const nextId = nextRaw ? Number(nextRaw) : null;
  const currentId = currentRaw ? Number(currentRaw) : null;
  if (nextId === currentId || (nextId == null && currentId == null)) return {};
  if (!canAssign) return { error: 'assign_required' };
  return { owner_staff_id: nextId };
}

export function suggestAmAccountCode(name: string, now = Date.now()): string {
  const slug = name.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase() || 'AM';
  return `${slug}${String(now).slice(-4)}`;
}

export type AmIndustryField = {
  id: string;
  api_key: string;
  industry_slug?: string | null;
  published?: boolean;
  label?: string;
  field_type?: string;
  required?: boolean;
};

export function amMatchingIndustryFields<T extends AmIndustryField>(
  fields: T[],
  industrySlug: string,
): T[] {
  const slug = String(industrySlug ?? '').trim().toLowerCase();
  return fields.filter((row) => {
    if (!row.published) return false;
    const fieldSlug = String(row.industry_slug ?? '').trim().toLowerCase();
    return !fieldSlug || fieldSlug === slug;
  });
}

export function amFieldValuesPayload(
  fields: Array<{ api_key: string }>,
  values: Record<string, unknown>,
): { values: Record<string, unknown> } {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(values, field.api_key)) {
      out[field.api_key] = values[field.api_key];
    }
  }
  return { values: out };
}

export function emptyAmFormContact(primary = false): AmFormContact {
  return {
    full_name: '',
    title: '',
    role_committee: 'decision_maker',
    is_primary: primary,
    sentiment: 'neutral',
    channel: 'zalo',
    renewal_attitude: 'neutral',
    email: '',
    phone: '',
  };
}
