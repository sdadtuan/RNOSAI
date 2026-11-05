export const AM_RISK_CATEGORIES = [
  { value: 'churn', label: 'Churn' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'commercial', label: 'Thương mại' },
  { value: 'financial', label: 'Tài chính' },
  { value: 'stakeholder', label: 'Stakeholder' },
  { value: 'other', label: 'Khác' },
] as const;

export const AM_RISK_SEVERITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
] as const;

export function amRecoveryRequiredCopy(): string {
  return 'Critical — bắt buộc recovery plan đang mở trước khi tạo care plan.';
}

export function amRiskPxI(
  probability: number | string | '' | null | undefined,
  impact: number | string | '' | null | undefined,
): string {
  const p = Number(probability);
  const i = Number(impact);
  if (!Number.isFinite(p) || !Number.isFinite(i) || p <= 0 || i <= 0) return '—';
  return String(p * i);
}
