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
