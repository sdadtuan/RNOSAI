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

export type RevopsPipelineStage =
  | 'discovery'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'contract_review';

export type RevopsPipelineDto = {
  view: 'kanban' | 'list';
  kpis: {
    totalVnd: number | null;
    weightedVnd: number | null;
    commitVnd: number | null;
    staleCount: number;
  };
  columns: Array<{
    stage: RevopsPipelineStage;
    count: number;
    valueVnd: number | null;
    cards: Array<{
      id: string;
      leadId: number;
      name: string;
      product: string;
      amountVnd: number | null;
      closeDate: string | null;
      owner: string;
      risk: string | null;
      href: string;
    }>;
  }>;
  fetchedAt: string;
};

export type RevopsPipelineQuery = {
  view?: 'kanban' | 'list' | string;
  scope?: RevopsScope | string;
};

export type RevopsApprovalKind = 'discount' | 'commission' | 'clawback' | 'account_reassignment';

export type RevopsApprovalItem = {
  id: string;
  kind: RevopsApprovalKind;
  sourceKind: string;
  title: string;
  typeLabel: string;
  relatedRecord: string;
  requestedBy: string;
  amountImpact: string | null;
  currentStep: string;
  dueAt: string | null;
  status: string;
  href: string | null;
  canAct: boolean;
  isOverdue: boolean;
};

export type RevopsDiscountMatrixRow = {
  band: string;
  steps: string[];
};

export type RevopsApprovalsDto = {
  kpis: {
    waitingForMe: number;
    pendingAll: number;
    approvedToday: number;
    overdue: number;
  };
  queue: RevopsApprovalItem[];
  discountMatrix: RevopsDiscountMatrixRow[];
  fetchedAt: string;
};
