import { expect, type APIRequestContext } from '@playwright/test';
import { API_URL, staffToken } from './ai-copilot-helpers';

export type RevopsCommissionHubDto = {
  summary: { estimatedVnd: number | null; approvedVnd: number | null; pendingVnd: number | null };
  weights: { newPct: number; renewalPct: number; upsellPct: number; slaPct: number };
  projections: { newVnd: number; renewalVnd: number; upsellVnd: number; slaVnd: number; totalVnd: number };
  staffRows: Array<{ staffId: number; name: string }>;
  transactions: unknown[];
  payoutBatches: unknown[];
  activePlan: { name: string; version: number } | null;
};

export type RevopsCommandCenterDto = {
  commission: { estimatedVnd: number | null; approvedVnd: number | null; pendingVnd: number | null };
};

export type RevopsSlaCenterDto = {
  kpis: { complianceTargetPct: number; breaches: number };
  incidents: unknown[];
};

export type RevopsTerritoryCenterDto = {
  kpis: { activeTerritories: number };
  rules: unknown[];
};

export type RevopsRoutingSimulateDto = {
  rankedOwners: Array<{ staffId: number; name: string; score: number }>;
};

export async function fetchRevopsCommissionHubApi(
  request: APIRequestContext,
  token: string,
): Promise<RevopsCommissionHubDto> {
  const res = await request.get(`${API_URL}/api/crm/revops/commission/hub`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), `commission hub: ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()) as RevopsCommissionHubDto;
}

export async function fetchRevopsCommandCenterApi(
  request: APIRequestContext,
  token: string,
): Promise<RevopsCommandCenterDto> {
  const res = await request.get(`${API_URL}/api/crm/revops/command-center`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), `command center: ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()) as RevopsCommandCenterDto;
}

export async function fetchRevopsSlaCenterApi(
  request: APIRequestContext,
  token: string,
): Promise<RevopsSlaCenterDto> {
  const res = await request.get(`${API_URL}/api/crm/revops/sla`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), `sla center: ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()) as RevopsSlaCenterDto;
}

export async function fetchRevopsTerritoryCenterApi(
  request: APIRequestContext,
  token: string,
): Promise<RevopsTerritoryCenterDto> {
  const res = await request.get(`${API_URL}/api/crm/revops/territory`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), `territory center: ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()) as RevopsTerritoryCenterDto;
}

export async function simulateRevopsRoutingApi(
  request: APIRequestContext,
  token: string,
  leadId?: number,
): Promise<RevopsRoutingSimulateDto> {
  const res = await request.post(`${API_URL}/api/crm/revops/routing/simulate`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { lead_id: leadId },
  });
  expect(res.ok(), `routing simulate: ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()) as RevopsRoutingSimulateDto;
}

export async function createCommissionTransactionApi(
  request: APIRequestContext,
  token: string,
  body: {
    deal_ref: string;
    staff_id: number;
    eligible_vnd: number;
    rate_pct: number;
    split_pct?: number;
    commission_vnd?: number;
  },
): Promise<{ commissionVnd: number; eligibleVnd: number; ratePct: number; splitPct: number }> {
  const res = await request.post(`${API_URL}/api/crm/revops/commission/transactions`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: body,
  });
  expect(res.ok(), `commission tx: ${res.status()} ${await res.text()}`).toBeTruthy();
  const out = (await res.json()) as {
    commissionVnd: number;
    eligibleVnd: number;
    ratePct: number;
    splitPct: number;
  };
  return out;
}

/** calcCommissionVnd mirror for e2e assertion */
export function calcCommissionVnd(eligibleVnd: number, ratePct: number, splitPct: number): number {
  return Math.round((eligibleVnd * ratePct * splitPct) / 10_000);
}

export { staffToken };
