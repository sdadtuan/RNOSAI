export const REVOPS_ROUTING_DEFAULT_RULES = [
  {
    name: 'Existing account match',
    priority: 10,
    method: 'named_account',
    conditionJson: { match: 'existing_account' },
  },
  {
    name: 'Named account owner',
    priority: 20,
    method: 'named_account',
    conditionJson: { match: 'named_account' },
  },
  {
    name: 'Territory + industry',
    priority: 30,
    method: 'territory',
    conditionJson: { match: 'territory_industry' },
  },
  {
    name: 'Capacity balancing',
    priority: 40,
    method: 'capacity',
    conditionJson: { match: 'capacity_balance' },
  },
] as const;

export type RevopsRoutingRuleInput = {
  id: string;
  name: string;
  priority: number;
  method: string;
  conditionJson: Record<string, unknown>;
  status: string;
};

export type RevopsRoutingStaffInput = {
  staffId: number;
  name: string;
  department: string | null;
  openLeads: number;
  namedAccounts: number;
};

export type RevopsRoutingLeadContext = {
  leadId: number | null;
  agencyClientId: string | null;
  industry: string | null;
  accountOwnerStaffId: number | null;
};

export type RevopsRoutingRankedOwner = {
  staffId: number;
  name: string;
  ruleId: string | null;
  ruleName: string;
  score: number;
};

function matchCondition(rule: RevopsRoutingRuleInput): string {
  const raw = rule.conditionJson?.match;
  return typeof raw === 'string' ? raw : rule.method;
}

export function rankRoutingOwners(
  lead: RevopsRoutingLeadContext,
  rules: RevopsRoutingRuleInput[],
  staff: RevopsRoutingStaffInput[],
): RevopsRoutingRankedOwner[] {
  const published = rules
    .filter((r) => r.status === 'published')
    .sort((a, b) => a.priority - b.priority);
  const scored = new Map<number, RevopsRoutingRankedOwner>();

  const push = (row: RevopsRoutingRankedOwner) => {
    const prev = scored.get(row.staffId);
    if (!prev || row.score > prev.score) scored.set(row.staffId, row);
  };

  for (const rule of published) {
    const match = matchCondition(rule);
    if (rule.method === 'named_account' && match === 'existing_account') {
      if (lead.agencyClientId && lead.accountOwnerStaffId) {
        const owner = staff.find((s) => s.staffId === lead.accountOwnerStaffId);
        push({
          staffId: lead.accountOwnerStaffId,
          name: owner?.name ?? `Staff #${lead.accountOwnerStaffId}`,
          ruleId: rule.id,
          ruleName: rule.name,
          score: 100,
        });
      }
      continue;
    }
    if (rule.method === 'named_account') {
      if (lead.accountOwnerStaffId) {
        const owner = staff.find((s) => s.staffId === lead.accountOwnerStaffId);
        push({
          staffId: lead.accountOwnerStaffId,
          name: owner?.name ?? `Staff #${lead.accountOwnerStaffId}`,
          ruleId: rule.id,
          ruleName: rule.name,
          score: 90,
        });
      }
      continue;
    }
    if (rule.method === 'territory') {
      const industry = (lead.industry ?? '').trim().toLowerCase();
      const pool = industry
        ? staff.filter((s) => (s.department ?? '').toLowerCase().includes(industry))
        : staff;
      const sorted = [...(pool.length > 0 ? pool : staff)].sort(
        (a, b) => a.openLeads + a.namedAccounts - (b.openLeads + b.namedAccounts),
      );
      sorted.slice(0, 3).forEach((row, idx) => {
        push({
          staffId: row.staffId,
          name: row.name,
          ruleId: rule.id,
          ruleName: rule.name,
          score: 80 - idx * 5,
        });
      });
      continue;
    }
    if (rule.method === 'capacity') {
      const sorted = [...staff].sort(
        (a, b) => a.openLeads + a.namedAccounts - (b.openLeads + b.namedAccounts),
      );
      sorted.slice(0, 5).forEach((row, idx) => {
        push({
          staffId: row.staffId,
          name: row.name,
          ruleId: rule.id,
          ruleName: rule.name,
          score: 70 - idx * 5,
        });
      });
      continue;
    }
    if (rule.method === 'round_robin') {
      const pool = staff.length > 0 ? staff : [];
      if (pool.length === 0) continue;
      const start = lead.leadId && lead.leadId > 0 ? lead.leadId % pool.length : 0;
      const rotated = [...pool.slice(start), ...pool.slice(0, start)];
      rotated.slice(0, 5).forEach((row, idx) => {
        push({
          staffId: row.staffId,
          name: row.name,
          ruleId: rule.id,
          ruleName: rule.name,
          score: 60 - idx * 5,
        });
      });
    }
  }

  if (scored.size === 0 && staff.length > 0) {
    const start = lead.leadId && lead.leadId > 0 ? lead.leadId % staff.length : 0;
    return [...staff.slice(start), ...staff.slice(0, start)].slice(0, 5).map((row, idx) => ({
      staffId: row.staffId,
      name: row.name,
      ruleId: null,
      ruleName: 'fallback',
      score: 50 - idx * 5,
    }));
  }

  return [...scored.values()].sort((a, b) => b.score - a.score).slice(0, 5);
}

export function territoryLoadPct(openLeads: number, namedAccounts: number, capacity: number | null): number | null {
  if (capacity == null || capacity <= 0) return null;
  return Math.min(100, Math.round(((openLeads + namedAccounts) / capacity) * 100));
}

export function aggregateUtilizationPct(
  territories: Array<{ loadPct: number | null }>,
): number | null {
  const loads = territories.map((t) => t.loadPct).filter((v): v is number => v != null);
  if (loads.length === 0) return null;
  return Math.round(loads.reduce((sum, v) => sum + v, 0) / loads.length);
}
