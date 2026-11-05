const COST_KEYS = ['monthly_salary', 'insurance_pct', 'monthly_benefits', 'hourly_rate', 'rate', 'rate_display'] as const;

export function stripPricingCost<T extends Record<string, unknown>>(row: T, canViewCost: boolean): T {
  if (canViewCost) return row;
  const next = { ...row };
  for (const key of COST_KEYS) delete next[key];
  return next;
}

export function stripPricingView<T extends Record<string, unknown>>(view: T, canViewCost: boolean): T {
  if (canViewCost) return view;
  const next = { ...view } as T & { roles?: Array<Record<string, unknown>>; rates?: unknown };
  if (Array.isArray(next.roles)) next.roles = next.roles.map((role) => stripPricingCost(role, false));
  delete next.rates;
  return next;
}
