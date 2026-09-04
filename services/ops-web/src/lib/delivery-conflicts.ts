export function detectScopeConflicts(serviceCodes: string[]): string[] {
  const out: string[] = [];
  if (serviceCodes.includes('creative_production')) out.push('creative_missing_brand_guideline');
  if (serviceCodes.includes('crm_automation')) out.push('crm_access_unconfirmed');
  return out;
}

export const DELIVERY_CONFLICT_LABELS: Record<string, string> = {
  creative_missing_brand_guideline: 'Creative Production cần brand guideline',
  crm_access_unconfirmed: 'CRM Automation cần xác nhận quyền truy cập',
};
