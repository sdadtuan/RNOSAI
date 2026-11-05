import {
  REVOPS_ROUTING_DEFAULT_RULES,
  aggregateUtilizationPct,
  rankRoutingOwners,
  territoryLoadPct,
} from './revops-routing.util';

describe('revops-routing.util', () => {
  const staff = [
    { staffId: 1, name: 'Alice', department: 'Sales HN', openLeads: 5, namedAccounts: 2 },
    { staffId: 2, name: 'Bob', department: 'Sales HCM', openLeads: 2, namedAccounts: 1 },
    { staffId: 3, name: 'Carol', department: 'Enterprise', openLeads: 8, namedAccounts: 0 },
  ];

  const rules = REVOPS_ROUTING_DEFAULT_RULES.map((r, idx) => ({
    id: `r${idx}`,
    name: r.name,
    priority: r.priority,
    method: r.method,
    conditionJson: r.conditionJson as Record<string, unknown>,
    status: 'published',
  }));

  it('prioritizes existing account owner', () => {
    const out = rankRoutingOwners(
      {
        leadId: 42,
        agencyClientId: 'client-1',
        industry: 'retail',
        accountOwnerStaffId: 2,
      },
      rules,
      staff,
    );
    expect(out[0]).toMatchObject({ staffId: 2, score: 100, ruleName: 'Existing account match' });
  });

  it('ranks by capacity when no account match', () => {
    const out = rankRoutingOwners(
      { leadId: 7, agencyClientId: null, industry: null, accountOwnerStaffId: null },
      rules.filter((r) => r.method === 'capacity'),
      staff,
    );
    expect(out[0]?.staffId).toBe(2);
  });

  it('computes territory load pct', () => {
    expect(territoryLoadPct(3, 2, 10)).toBe(50);
    expect(territoryLoadPct(20, 0, 10)).toBe(100);
    expect(territoryLoadPct(1, 1, null)).toBeNull();
  });

  it('aggregates utilization', () => {
    expect(aggregateUtilizationPct([{ loadPct: 40 }, { loadPct: 60 }])).toBe(50);
    expect(aggregateUtilizationPct([{ loadPct: null }])).toBeNull();
  });
});
