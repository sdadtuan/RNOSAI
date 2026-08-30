export type StaffCap = { section: string; action: string };

function hasCap(caps: StaffCap[], section: string, action: string): boolean {
  return caps.some((c) => c.section === section && c.action === action);
}

export function hasCeoView(caps: StaffCap[]): boolean {
  return (
    hasCap(caps, 'ceo_command', 'view') ||
    hasCap(caps, 'ai_analytics', 'query') ||
    hasCap(caps, 'crm_business_dashboard', 'view') ||
    hasCap(caps, 'ai_admin', 'view')
  );
}

export function hasCeoAct(caps: StaffCap[]): boolean {
  return hasCap(caps, 'ceo_command', 'act');
}

export function hasCeoConfigure(caps: StaffCap[]): boolean {
  return (
    hasCap(caps, 'ceo_command', 'configure') ||
    hasCap(caps, 'ai_admin', 'configure') ||
    hasCap(caps, 'playbooks', 'configure')
  );
}

export function hasCeoFinanceView(caps: StaffCap[]): boolean {
  return hasCap(caps, 'crm_business_dashboard', 'view');
}

export function hasOpsView(caps: StaffCap[]): boolean {
  return hasCap(caps, 'crm_leads', 'view');
}

export function hasOpsWrite(caps: StaffCap[]): boolean {
  return hasCap(caps, 'crm_board', 'edit');
}

export function hasDealAccess(caps: StaffCap[]): boolean {
  return (
    hasCap(caps, 'crm_sales_funnel', 'view') || hasCap(caps, 'crm_sales_overview', 'view')
  );
}

export function hasLeadAssign(caps: StaffCap[]): boolean {
  return hasCap(caps, 'crm_leads', 'assign');
}

export function hasLeadEdit(caps: StaffCap[]): boolean {
  return hasCap(caps, 'crm_leads', 'edit');
}
