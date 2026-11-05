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

export type RevopsCommissionSummaryDto = {
  estimatedVnd: number | null;
  approvedVnd: number | null;
  pendingVnd: number | null;
};

export type RevopsCommissionStaffRowDto = {
  staffId: number;
  name: string;
  estimatedVnd: number;
  approvedVnd: number;
  pendingVnd: number;
  transactionCount: number;
};

export type RevopsCommissionHubDto = {
  summary: RevopsCommissionSummaryDto;
  weights: { newPct: number; renewalPct: number; upsellPct: number; slaPct: number };
  projections: {
    newVnd: number;
    renewalVnd: number;
    upsellVnd: number;
    slaVnd: number;
    totalVnd: number;
  };
  staffRows: RevopsCommissionStaffRowDto[];
  transactions: RevopsCommissionTransactionDto[];
  payoutBatches: RevopsPayoutBatchDto[];
  activePlan: RevopsCommissionPlanDto | null;
  fetchedAt: string;
};

export type RevopsCommissionTierDto = {
  id: string;
  minAttainmentPct: number;
  maxAttainmentPct: number | null;
  ratePct: number;
};

export type RevopsCommissionPlanDto = {
  id: string;
  name: string;
  version: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  revenueBasis: string;
  roleCode: string;
  status: string;
  tiers: RevopsCommissionTierDto[];
};

export type RevopsCreateCommissionPlanBody = {
  name: string;
  version?: number;
  effective_from: string;
  effective_to?: string;
  revenue_basis?: string;
  role_code?: string;
  tiers: Array<{
    min_attainment_pct: number;
    max_attainment_pct?: number | null;
    rate_pct: number;
  }>;
};

export type RevopsCommissionTransactionDto = {
  id: string;
  dealRef: string;
  staffId: number;
  eligibleVnd: number;
  ratePct: number;
  splitPct: number;
  commissionVnd: number;
  status: string;
  payoutBatchId: string | null;
  createdAt: string;
};

export type RevopsCreateCommissionTransactionBody = {
  deal_ref: string;
  staff_id: number;
  eligible_vnd: number;
  rate_pct: number;
  split_pct?: number;
  commission_vnd?: number;
  status?: string;
};

export type RevopsPayoutBatchDto = {
  id: string;
  period: string;
  status: string;
  lockedAt: string | null;
  createdAt: string;
};

export type RevopsCreatePayoutBatchBody = {
  period: string;
};

export type RevopsSlaPolicyDto = {
  id: string;
  name: string;
  entityType: string;
  durationMinutes: number;
  warningMinutes: number;
  escalateJson: unknown;
};

export type RevopsSlaIncidentDto = {
  id: string;
  entityType: string;
  entityId: string;
  policyId: string | null;
  ownerId: number | null;
  dueAt: string;
  breachedAt: string | null;
  status: string;
  title: string;
  assignableLeadId: number | null;
};

export type RevopsSlaBreachTrendPoint = {
  day: string;
  count: number;
};

export type RevopsSlaCenterDto = {
  kpis: {
    compliancePct: number | null;
    complianceTargetPct: number;
    openWarnings: number;
    breaches: number;
    autoReassignments: number;
  };
  incidents: RevopsSlaIncidentDto[];
  policies: RevopsSlaPolicyDto[];
  breachTrend7d: RevopsSlaBreachTrendPoint[];
  fetchedAt: string;
};

export type RevopsUpdateSlaPolicyBody = {
  name?: string;
  duration_minutes?: number;
  warning_minutes?: number;
};

export type RevopsCreateSlaPolicyBody = {
  name: string;
  entity_type: string;
  duration_minutes: number;
  warning_minutes?: number;
  escalate_json?: unknown[];
};

export type RevopsTerritoryDto = {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  parentName: string | null;
  teamLabel: string | null;
  capacity: number | null;
  openLeads: number;
  namedAccounts: number;
  loadPct: number | null;
};

export type RevopsUpdateTerritoryBody = {
  name?: string;
  type?: string;
  parent_id?: string | null;
  team_label?: string;
  capacity?: number | null;
};

export type RevopsRoutingRuleDto = {
  id: string;
  name: string;
  priority: number;
  conditionJson: unknown;
  method: string;
  fallback: string | null;
  status: string;
};

export type RevopsTerritoryCenterDto = {
  kpis: {
    activeTerritories: number;
    coverageGaps: number;
    utilizationPct: number | null;
  };
  territories: RevopsTerritoryDto[];
  rules: RevopsRoutingRuleDto[];
  fetchedAt: string;
};

export type RevopsCreateTerritoryBody = {
  name: string;
  type?: string;
  parent_id?: string;
  team_label?: string;
  capacity?: number;
};

export type RevopsCreateRoutingRuleBody = {
  name: string;
  priority?: number;
  condition_json?: Record<string, unknown>;
  method?: string;
  fallback?: string;
};

export type RevopsRoutingSimulateBody = {
  lead_id?: number;
};

export type RevopsRoutingSimulateResult = {
  leadId: number | null;
  rankedOwners: Array<{
    staffId: number;
    name: string;
    ruleId: string | null;
    ruleName: string;
    score: number;
  }>;
};

export type RevopsReportsQuery = RevopsDashboardQuery & {
  territory?: string;
};

export type RevopsReportLibraryItemDto = {
  slug: string;
  name: string;
  description: string;
  group: string;
  owner: string;
  scheduleLabel: string;
  schedulerStatus: 'manual';
  lastUpdated: string;
};

export type RevopsReportsDto = {
  filters: {
    period: string;
    periodLabel: string;
    bu: string;
    territory: string;
    currency: 'VND';
  };
  territoryOptions: Array<{ value: string; label: string }>;
  cards: {
    revenueVsForecast: {
      periodLabel: string;
      points: Array<{
        month: string;
        label: string;
        actualVnd: number | null;
        forecastVnd: number | null;
      }>;
    };
    revenueMix: {
      rows: Array<{ key: string; label: string; vnd: number; pct: number | null }>;
      totalVnd: number;
    };
    commissionLiability: {
      totalVnd: number | null;
      approvedVnd: number | null;
      pendingVnd: number | null;
      clawbackVnd: number | null;
    };
  };
  library: RevopsReportLibraryItemDto[];
  slaSnapshot: {
    compliancePct: number | null;
    breaches: number;
    incidentCount: number;
  };
  atRisk: RevopsRiskItem[];
  transactions: RevopsCommissionTransactionDto[];
  slaIncidents: RevopsSlaIncidentDto[];
  fetchedAt: string;
};

export type RevopsSettingsDto = {
  org: {
    activeUsers: number | null;
    businessUnits: number | null;
    teams: number | null;
    pendingLifecycle: number | null;
  };
  dataQuality: {
    totalIssues: number;
    issues: Array<{
      key: string;
      label: string;
      count: number;
      severity: 'critical' | 'warning';
      href: string | null;
    }>;
  };
  integrations: {
    healthyCount: number;
    totalCount: number;
    items: Array<{
      key: string;
      label: string;
      status: 'healthy' | 'warning' | 'critical' | 'unknown';
      detail: string;
      lastSyncAt: string | null;
    }>;
  };
  roleMatrix: Array<{
    module: string;
    sales: string;
    aeAm: string;
    teamLead: string;
    finance: string;
    admin: string;
  }>;
  auditTimeline: Array<{
    id: string;
    title: string;
    detail: string;
    createdAt: string;
    href: string;
  }>;
  adminLinks: {
    users: string;
    departments: string;
    teams: string;
    permissions: string;
    audit: string;
    auditExport: string;
  };
  fetchedAt: string;
};
