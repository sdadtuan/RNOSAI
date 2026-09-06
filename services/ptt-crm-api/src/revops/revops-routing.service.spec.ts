import { RevopsRoutingService } from './revops-routing.service';

describe('RevopsRoutingService', () => {
  it('seeds default rules and computes utilization from territory loads', async () => {
    const db = {
      query: jest.fn().mockImplementation(async (sql: string) => {
        if (/SELECT id FROM crm_revops_routing_rules/i.test(sql) && /name = \$2/i.test(sql)) {
          return { rows: [] };
        }
        if (/INSERT INTO crm_revops_routing_rules/i.test(sql)) {
          return { rows: [], rowCount: 1 };
        }
        if (/FROM crm_revops_territories t/i.test(sql)) {
          return {
            rows: [
              {
                id: 't1',
                name: 'HN Sales',
                type: 'team',
                parent_id: null,
                parent_name: null,
                team_label: 'HN',
                capacity: 20,
                open_leads: 5,
                named_accounts: 5,
              },
            ],
          };
        }
        if (/FROM crm_revops_routing_rules/i.test(sql) && /ORDER BY priority/i.test(sql)) {
          return {
            rows: [
              {
                id: 'r1',
                name: 'Capacity balancing',
                priority: 40,
                condition_json: { match: 'capacity_balance' },
                method: 'capacity',
                fallback: null,
                status: 'published',
              },
            ],
          };
        }
        return { rows: [] };
      }),
    };
    const svc = new RevopsRoutingService(db as never);
    const out = await svc.getCenter();
    expect(out.kpis.activeTerritories).toBe(1);
    expect(out.kpis.utilizationPct).toBe(50);
    expect(out.territories[0]?.loadPct).toBe(50);
    expect(db.query.mock.calls.some(([s]) => /INSERT INTO crm_revops_routing_rules/i.test(String(s)))).toBe(
      true,
    );
  });

  it('simulates ranked owners for lead with account owner', async () => {
    const db = {
      query: jest.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
        if (/SELECT id FROM crm_revops_routing_rules/i.test(sql) && /name = \$2/i.test(sql)) {
          return { rows: [{ id: 'r1' }] };
        }
        if (/FROM crm_leads l/i.test(sql)) {
          return {
            rows: [{ sqlite_lead_id: params?.[0], agency_client_id: 'uuid-1', industry: 'retail' }],
          };
        }
        if (/crm_am_account_ext/i.test(sql)) {
          return { rows: [{ account_owner_staff_id: 9 }] };
        }
        if (/FROM crm_staff cs/i.test(sql)) {
          return {
            rows: [
              { id: 9, name: 'Owner AM', department: 'Enterprise', open_leads: 1, named_accounts: 3 },
              { id: 2, name: 'Bob', department: 'Sales', open_leads: 4, named_accounts: 0 },
            ],
          };
        }
        if (/FROM crm_revops_routing_rules/i.test(sql)) {
          return {
            rows: [
              {
                id: 'r1',
                name: 'Existing account match',
                priority: 10,
                condition_json: { match: 'existing_account' },
                method: 'named_account',
                status: 'published',
              },
            ],
          };
        }
        return { rows: [] };
      }),
    };
    const svc = new RevopsRoutingService(db as never);
    const out = await svc.simulate({ lead_id: 55 });
    expect(out.leadId).toBe(55);
    expect(out.rankedOwners[0]).toMatchObject({ staffId: 9, score: 100 });
  });
});
