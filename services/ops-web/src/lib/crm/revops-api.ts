import { API_BASE, ApiError, parseJson } from '@/lib/api';

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

export type RevopsCommandCenterQuery = {
  period?: string;
  bu?: string;
  scope?: string;
};

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function revopsFetch<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<T & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'RevOps request failed', res.status);
  }
  return body;
}

export async function fetchRevopsCommandCenter(
  token: string,
  query: RevopsCommandCenterQuery = {},
): Promise<RevopsCommandCenterDto> {
  const params = new URLSearchParams();
  if (query.period) params.set('period', query.period);
  if (query.bu) params.set('bu', query.bu);
  if (query.scope) params.set('scope', query.scope);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return revopsFetch<RevopsCommandCenterDto>(token, `/api/crm/revops/command-center${suffix}`);
}

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
  view?: 'kanban' | 'list';
  scope?: string;
};

export async function fetchRevopsPipeline(
  token: string,
  query: RevopsPipelineQuery = {},
): Promise<RevopsPipelineDto> {
  const params = new URLSearchParams();
  if (query.view) params.set('view', query.view);
  if (query.scope) params.set('scope', query.scope);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return revopsFetch<RevopsPipelineDto>(token, `/api/crm/revops/pipeline${suffix}`);
}

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

export type RevopsApprovalsDto = {
  kpis: {
    waitingForMe: number;
    pendingAll: number;
    approvedToday: number;
    overdue: number;
  };
  queue: RevopsApprovalItem[];
  discountMatrix: Array<{ band: string; steps: string[] }>;
  fetchedAt: string;
};

export async function fetchRevopsApprovals(token: string): Promise<RevopsApprovalsDto> {
  return revopsFetch<RevopsApprovalsDto>(token, '/api/crm/revops/approvals');
}

export type RevopsCommissionPlan = {
  id: string;
  name: string;
  version: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  revenueBasis: string;
  roleCode: string;
  status: string;
  tiers: Array<{ id: string; minAttainmentPct: number; maxAttainmentPct: number | null; ratePct: number }>;
};

export type RevopsPayoutBatch = {
  id: string;
  period: string;
  status: string;
  lockedAt: string | null;
  createdAt: string;
};

export type RevopsCommissionTransaction = {
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

export type RevopsCommissionHubDto = {
  summary: { estimatedVnd: number | null; approvedVnd: number | null; pendingVnd: number | null };
  weights: { newPct: number; renewalPct: number; upsellPct: number; slaPct: number };
  projections: { newVnd: number; renewalVnd: number; upsellVnd: number; slaVnd: number; totalVnd: number };
  staffRows: Array<{
    staffId: number;
    name: string;
    estimatedVnd: number;
    approvedVnd: number;
    pendingVnd: number;
    transactionCount: number;
  }>;
  transactions: RevopsCommissionTransaction[];
  payoutBatches: RevopsPayoutBatch[];
  activePlan: RevopsCommissionPlan | null;
  fetchedAt: string;
};

export type RevopsSlaCenterDto = {
  kpis: {
    compliancePct: number | null;
    complianceTargetPct: number;
    openWarnings: number;
    breaches: number;
    autoReassignments: number;
  };
  incidents: Array<{
    id: string;
    entityType: string;
    entityId: string;
    status: string;
    dueAt: string;
    title: string;
    assignableLeadId: number | null;
    ownerId?: number | null;
  }>;
  policies: Array<{ id: string; name: string; entityType: string; durationMinutes: number; warningMinutes?: number }>;
  breachTrend7d: Array<{ day: string; count: number }>;
  fetchedAt: string;
};

export type RevopsTerritoryCenterDto = {
  kpis: { activeTerritories: number; coverageGaps: number; utilizationPct: number | null };
  territories: Array<{
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
  }>;
  rules: Array<{ id: string; name: string; priority: number; method: string; status: string }>;
  fetchedAt: string;
};

export type RevopsRoutingRankedOwner = {
  staffId: number;
  name: string;
  ruleId: string | null;
  ruleName: string;
  score: number;
};

async function revopsMutate<T>(token: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const parsed = await parseJson<T & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(parsed.error ?? parsed.message ?? 'RevOps request failed', res.status);
  }
  return parsed;
}

export async function fetchRevopsCommissionPlans(token: string): Promise<{ items: RevopsCommissionPlan[] }> {
  return revopsFetch(token, '/api/crm/revops/commission/plans');
}

export async function fetchRevopsCommissionHub(token: string): Promise<RevopsCommissionHubDto> {
  return revopsFetch(token, '/api/crm/revops/commission/hub');
}

export async function fetchRevopsCommissionTransactions(
  token: string,
  limit = 100,
): Promise<{ items: RevopsCommissionTransaction[] }> {
  return revopsFetch(token, `/api/crm/revops/commission/transactions?limit=${limit}`);
}

export async function createRevopsCommissionPlan(
  token: string,
  body: {
    name: string;
    version?: number;
    effective_from: string;
    revenue_basis?: string;
    role_code?: string;
    tiers: Array<{ min_attainment_pct: number; max_attainment_pct?: number | null; rate_pct: number }>;
  },
): Promise<RevopsCommissionPlan> {
  return revopsMutate(token, '/api/crm/revops/commission/plans', body);
}

export async function fetchRevopsPayoutBatches(token: string): Promise<{ items: RevopsPayoutBatch[] }> {
  return revopsFetch(token, '/api/crm/revops/commission/payout-batches');
}

export async function createRevopsPayoutBatch(token: string, period: string): Promise<RevopsPayoutBatch> {
  return revopsMutate(token, '/api/crm/revops/commission/payout-batches', { period });
}

export async function lockRevopsPayoutBatch(token: string, id: string): Promise<RevopsPayoutBatch> {
  return revopsMutate(token, `/api/crm/revops/commission/payout-batches/${id}/lock`, {});
}

export async function fetchRevopsSlaCenter(token: string): Promise<RevopsSlaCenterDto> {
  return revopsFetch(token, '/api/crm/revops/sla');
}

export async function fetchRevopsTerritoryCenter(token: string): Promise<RevopsTerritoryCenterDto> {
  return revopsFetch(token, '/api/crm/revops/territory');
}

export async function simulateRevopsRouting(
  token: string,
  leadId?: number,
): Promise<{ leadId: number | null; rankedOwners: RevopsRoutingRankedOwner[] }> {
  return revopsMutate(token, '/api/crm/revops/routing/simulate', { lead_id: leadId });
}

export async function createRevopsSlaPolicy(
  token: string,
  body: {
    name: string;
    entity_type: string;
    duration_minutes: number;
    warning_minutes?: number;
  },
): Promise<{ id: string; name: string; entityType: string; durationMinutes: number }> {
  return revopsMutate(token, '/api/crm/revops/sla/policies', body);
}

export async function updateRevopsSlaPolicy(
  token: string,
  id: string,
  body: { name?: string; duration_minutes?: number; warning_minutes?: number },
): Promise<{ id: string; name: string; entityType: string; durationMinutes: number }> {
  const res = await fetch(`${API_BASE}/api/crm/revops/sla/policies/${id}`, {
    method: 'PATCH',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const parsed = await parseJson<{ error?: string; message?: string } & Record<string, unknown>>(res);
  if (!res.ok) {
    throw new ApiError(parsed.error ?? parsed.message ?? 'RevOps request failed', res.status);
  }
  return parsed as { id: string; name: string; entityType: string; durationMinutes: number };
}

export async function deleteRevopsSlaPolicy(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/crm/revops/sla/policies/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) {
    const parsed = await parseJson<{ error?: string; message?: string }>(res);
    throw new ApiError(parsed.error ?? parsed.message ?? 'RevOps request failed', res.status);
  }
}

export async function createRevopsTerritory(
  token: string,
  body: {
    name: string;
    type?: string;
    parent_id?: string;
    team_label?: string;
    capacity?: number;
  },
): Promise<{ id: string; name: string; type: string }> {
  return revopsMutate(token, '/api/crm/revops/territory', body);
}

export async function updateRevopsTerritory(
  token: string,
  id: string,
  body: {
    name?: string;
    type?: string;
    parent_id?: string | null;
    team_label?: string;
    capacity?: number | null;
  },
): Promise<{ id: string; name: string; type: string }> {
  const res = await fetch(`${API_BASE}/api/crm/revops/territory/${id}`, {
    method: 'PATCH',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const parsed = await parseJson<{ error?: string; message?: string } & Record<string, unknown>>(res);
  if (!res.ok) {
    throw new ApiError(parsed.error ?? parsed.message ?? 'RevOps request failed', res.status);
  }
  return parsed as { id: string; name: string; type: string };
}

export async function deleteRevopsTerritory(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/crm/revops/territory/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) {
    const parsed = await parseJson<{ error?: string; message?: string }>(res);
    throw new ApiError(parsed.error ?? parsed.message ?? 'RevOps request failed', res.status);
  }
}

export type RevopsRoutingRule = {
  id: string;
  name: string;
  priority: number;
  method: string;
  status: string;
};

export async function createRevopsRoutingRule(
  token: string,
  body: {
    name: string;
    priority?: number;
    method?: string;
    condition_json?: Record<string, unknown>;
    fallback?: string;
  },
): Promise<RevopsRoutingRule> {
  return revopsMutate(token, '/api/crm/revops/routing/rules', body);
}

export async function publishRevopsRoutingRule(token: string, id: string): Promise<RevopsRoutingRule> {
  return revopsMutate(token, `/api/crm/revops/routing/rules/${id}/publish`, {});
}

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
  library: Array<{
    slug: string;
    name: string;
    description: string;
    group: string;
    owner: string;
    scheduleLabel: string;
    schedulerStatus: 'manual';
    lastUpdated: string;
  }>;
  slaSnapshot: {
    compliancePct: number | null;
    breaches: number;
    incidentCount: number;
  };
  atRisk: RevopsRiskItem[];
  transactions: RevopsCommissionTransaction[];
  slaIncidents: unknown[];
  fetchedAt: string;
};

export type RevopsReportsQuery = {
  period?: string;
  bu?: string;
  territory?: string;
  scope?: string;
};

export async function fetchRevopsReports(
  token: string,
  query: RevopsReportsQuery = {},
): Promise<RevopsReportsDto> {
  const params = new URLSearchParams();
  if (query.period) params.set('period', query.period);
  if (query.bu) params.set('bu', query.bu);
  if (query.territory) params.set('territory', query.territory);
  if (query.scope) params.set('scope', query.scope);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return revopsFetch<RevopsReportsDto>(token, `/api/crm/revops/reports${suffix}`);
}

export async function exportRevopsReportCsv(
  token: string,
  slug: string,
  query: RevopsReportsQuery = {},
): Promise<{ filename: string; csv: string }> {
  const params = new URLSearchParams();
  if (query.period) params.set('period', query.period);
  if (query.bu) params.set('bu', query.bu);
  if (query.territory) params.set('territory', query.territory);
  if (query.scope) params.set('scope', query.scope);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/crm/revops/reports/${slug}/export${suffix}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) {
    const parsed = await parseJson<{ error?: string; message?: string }>(res);
    throw new ApiError(parsed.error ?? parsed.message ?? 'RevOps export failed', res.status);
  }
  const csv = await res.text();
  const period = query.period ?? 'report';
  return { filename: `revops-${slug}-${period}.csv`, csv };
}

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

export async function fetchRevopsSettings(token: string): Promise<RevopsSettingsDto> {
  return revopsFetch<RevopsSettingsDto>(token, '/api/crm/revops/settings');
}
