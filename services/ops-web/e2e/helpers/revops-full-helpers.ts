/** RevOps B21 — 12 sidebar labels + native routes smoke (plan §0.6). */

export const REVOPS_SIDEBAR_LABELS = [
  'Command Center',
  'Leads & Routing',
  'Pipeline & Deal',
  'Account 360',
  'Handover & Onboarding',
  'Renewal & Growth',
  'KPI & Hoa hồng',
  'SLA & Escalation',
  'Báo cáo & Forecast',
  'Territory & Capacity',
  'Phê duyệt',
  'Cấu hình & Audit',
] as const;

export const REVOPS_NATIVE_ROUTES = [
  { path: '/crm/revenue-ops', heading: /Command Center/i },
  { path: '/crm/revenue-ops/pipeline', heading: /Pipeline & Deal/i },
  { path: '/crm/revenue-ops/sla', heading: /SLA & Escalation/i },
  { path: '/crm/revenue-ops/reports', heading: /Reports & Forecast/i },
  { path: '/crm/revenue-ops/territory', heading: /Territory & Capacity/i },
  { path: '/crm/revenue-ops/approvals', heading: /Approval Center/i },
  { path: '/crm/revenue-ops/settings', heading: /Cấu hình & Audit/i },
] as const;
