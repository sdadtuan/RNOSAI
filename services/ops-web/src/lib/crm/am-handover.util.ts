export type AmHandoverStepId = 'commercial' | 'scope' | 'stakeholder' | 'confirm';

export type AmHandoverStep = {
  id: AmHandoverStepId;
  label: string;
};

export const AM_HANDOVER_STEPS: AmHandoverStep[] = [
  { id: 'commercial', label: 'Thương mại' },
  { id: 'scope', label: 'Scope & KPI' },
  { id: 'stakeholder', label: 'Stakeholder' },
  { id: 'confirm', label: 'Xác nhận' },
];

export const AM_HANDOVER_CHECKLIST = [
  { key: 'understood_scope', label: 'Tôi đã hiểu scope, KPI và exclusion' },
  { key: 'stakeholders_access', label: 'Tôi đã nhận đủ thông tin stakeholder và quyền truy cập' },
  { key: 'delivery_owner', label: 'Tôi đã thống nhất owner Delivery/Onboarding' },
] as const;

export type AmHandoverChecklistKey = (typeof AM_HANDOVER_CHECKLIST)[number]['key'];
export type AmHandoverChecklistState = Partial<Record<AmHandoverChecklistKey, boolean>>;

export const AM_HANDOVER_STATUS_COPY: Record<string, string> = {
  draft: 'Nháp',
  pending_am: 'Chờ AM xác nhận',
  accepted: 'Đã nhận bàn giao',
  rejected: 'Từ chối',
  needs_info: 'Cần bổ sung thông tin',
};

export function amHandoverStatusCopy(status: string): string {
  return AM_HANDOVER_STATUS_COPY[status] ?? status;
}

export function amHandoverCanAccept(checklist: AmHandoverChecklistState): boolean {
  return AM_HANDOVER_CHECKLIST.every((item) => checklist[item.key] === true);
}

export function amHandoverReasonError(
  action: 'accept' | 'reject' | 'needs_info',
  reason: string,
): string {
  if (action === 'accept') return '';
  return String(reason ?? '').trim() ? '' : 'reason_required';
}

export function parseAmHandoverStep(raw: string | null | undefined): AmHandoverStepId {
  const hit = AM_HANDOVER_STEPS.find((step) => step.id === raw);
  return hit?.id ?? 'commercial';
}

export function amJsonField(data: Record<string, unknown> | null | undefined, key: string): string {
  const value = data?.[key];
  if (value == null || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
