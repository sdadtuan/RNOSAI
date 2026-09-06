import type { AdminIntegrationRow } from '../../admin-governance/admin-governance.types';

export type RevopsIntegrationHealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

export type RevopsIntegrationHealthItem = {
  key: string;
  label: string;
  status: RevopsIntegrationHealthStatus;
  detail: string;
  lastSyncAt: string | null;
};

export type RevopsRoleMatrixRow = {
  module: string;
  sales: string;
  aeAm: string;
  teamLead: string;
  finance: string;
  admin: string;
};

export type RevopsDataQualityIssue = {
  key: string;
  label: string;
  count: number;
  severity: 'critical' | 'warning';
  href: string | null;
};

export const REVOPS_ROLE_MATRIX: RevopsRoleMatrixRow[] = [
  {
    module: 'Lead & Routing',
    sales: 'Own',
    aeAm: 'Scoped',
    teamLead: 'Team',
    finance: '—',
    admin: 'All',
  },
  {
    module: 'Account 360',
    sales: 'Shared',
    aeAm: 'Own',
    teamLead: 'Team',
    finance: 'Limited',
    admin: 'All',
  },
  {
    module: 'Deal & Pipeline',
    sales: 'Own',
    aeAm: 'Shared',
    teamLead: 'Team',
    finance: 'Read',
    admin: 'All',
  },
  {
    module: 'KPI & Commission',
    sales: 'Self',
    aeAm: 'Self',
    teamLead: 'Team',
    finance: 'All finance',
    admin: 'All',
  },
  {
    module: 'Payout',
    sales: '—',
    aeAm: '—',
    teamLead: 'Propose',
    finance: 'Manage',
    admin: 'All',
  },
  {
    module: 'Audit logs',
    sales: '—',
    aeAm: '—',
    teamLead: 'Scoped',
    finance: 'Scoped',
    admin: 'All',
  },
];

function mapIntegrationStatus(status: AdminIntegrationRow['status'] | undefined): RevopsIntegrationHealthStatus {
  if (!status) return 'unknown';
  if (status === 'ok') return 'healthy';
  if (status === 'warning') return 'warning';
  if (status === 'critical') return 'critical';
  if (status === 'disabled') return 'warning';
  return 'unknown';
}

export function buildIntegrationHealth(integrations: AdminIntegrationRow[]): RevopsIntegrationHealthItem[] {
  const meta =
    integrations.find((i) => i.id === 'webhook-meta') ??
    integrations.find((i) => /meta|facebook/i.test(`${i.id} ${i.name}`));
  const erp = integrations.find((i) => /erp|accounting|gdkd|finance/i.test(`${i.id} ${i.name}`));
  const hr = integrations.find((i) => /hr|payroll|staff-sso/i.test(`${i.id} ${i.name}`));

  return [
    {
      key: 'erp',
      label: 'ERP / Accounting',
      status: mapIntegrationStatus(erp?.status),
      detail: erp?.detail ?? 'Chưa có health endpoint',
      lastSyncAt: null,
    },
    {
      key: 'facebook_leads',
      label: 'Facebook Lead Ads',
      status: mapIntegrationStatus(meta?.status),
      detail: meta?.detail ?? 'Chưa có health endpoint',
      lastSyncAt: null,
    },
    {
      key: 'hr_payroll',
      label: 'HR / Payroll',
      status: hr ? mapIntegrationStatus(hr.status) : 'unknown',
      detail: hr?.detail ?? 'Chưa có health endpoint',
      lastSyncAt: null,
    },
  ];
}

export function buildDataQualityIssues(input: {
  dealsWithoutNextAction: number;
  accountsWithoutOwner: number;
  strategicWithoutPlan: number;
}): RevopsDataQualityIssue[] {
  return [
    {
      key: 'deals_no_next_action',
      label: 'Deals without next action',
      count: input.dealsWithoutNextAction,
      severity: 'critical',
      href: '/crm/deal-room?revops=1',
    },
    {
      key: 'accounts_no_owner',
      label: 'Accounts without owner',
      count: input.accountsWithoutOwner,
      severity: 'critical',
      href: '/crm/account-management/clients?revops=1',
    },
    {
      key: 'strategic_no_plan',
      label: 'Strategic accounts without plan',
      count: input.strategicWithoutPlan,
      severity: 'warning',
      href: '/crm/account-management/clients?revops=1',
    },
  ];
}

export function dataQualityTotal(issues: RevopsDataQualityIssue[]): number {
  return issues.reduce((sum, row) => sum + row.count, 0);
}

export function integrationHealthyCount(items: RevopsIntegrationHealthItem[]): number {
  return items.filter((i) => i.status === 'healthy').length;
}

export function formatAuditTimelineSummary(input: {
  actorEmail: string;
  action: string;
  sectionId?: string;
  summary?: string;
}): string {
  if (input.summary?.trim()) return input.summary.trim();
  const actor = input.actorEmail.split('@')[0] ?? input.actorEmail;
  const section = input.sectionId ? ` · ${input.sectionId}` : '';
  return `${actor} · ${input.action}${section}`;
}
