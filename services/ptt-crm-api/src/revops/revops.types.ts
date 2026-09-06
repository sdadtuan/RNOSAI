export type RevopsScope = 'me' | 'team' | 'all';

export type RevopsTeamStatus = 'On track' | 'Accelerator' | 'Need attention' | 'At risk';

export type RevopsTeamPerformanceRow = {
  staffId: number;
  name: string;
  role: string;
  teamLabel: string;
  targetVnd: number | null;
  actualVnd: number | null;
  attainmentPct: number | null;
  pipelineVnd: number | null;
  leadActive: number;
  slaPct: number | null;
  status: RevopsTeamStatus;
};

export type RevopsActionItem = {
  id: string;
  kind: 'lead_no_response' | 'deal_stale' | 'contract_expiry';
  title: string;
  href: string;
  dueAt: string | null;
};

export type RevopsRiskItem = {
  id: string;
  kind: 'account_health' | 'renewal' | 'proposal_expiry';
  title: string;
  href: string;
  severity: 'warning' | 'danger';
};

export type RevopsCommandCenterDto = {
  period: string;
  bu: string;
  revenue: {
    actualVnd: number | null;
    targetVnd: number | null;
    attainmentPct: number | null;
    deltaPct: number | null;
  };
  pipeline: {
    weightedVnd: number | null;
    coverageX: number | null;
    activeDeals: number;
    commitDeals: number;
  };
  leadSla: { compliancePct: number | null; atRisk: number; breaches: number };
  commission: {
    estimatedVnd: number | null;
    approvedVnd: number | null;
    pendingVnd: number | null;
  };
  funnel: Array<{ stage: string; count: number }>;
  teamRevenue: Array<{
    teamId: string;
    label: string;
    actualVnd: number | null;
    targetVnd: number | null;
  }>;
  teamPerformance: RevopsTeamPerformanceRow[];
  todayQueue: RevopsActionItem[];
  atRisk: RevopsRiskItem[];
  fetchedAt: string;
};

export type RevopsDashboardQuery = {
  period?: string;
  bu?: string;
  scope?: RevopsScope | string;
};

export type RevopsDashboardActor = {
  staffId: number;
  caps: Array<{ section: string; action: string }>;
};
