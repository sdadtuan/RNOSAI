import { RevopsSlaService } from './revops-sla.service';

describe('RevopsSlaService.tick', () => {
  function mockDb() {
    return {
      query: jest
        .fn()
        .mockImplementation(async (sql: string) => {
          if (/ensureDefaultPolicies|crm_revops_sla_policies/i.test(sql) && /SELECT id, duration/i.test(sql)) {
            return { rows: [{ id: 'p1', duration_minutes: 60, warning_minutes: 36 }], rowCount: 1 };
          }
          if (/INSERT INTO crm_revops_sla_policies/i.test(sql)) {
            return { rows: [{ id: 'p-new', duration_minutes: 60, warning_minutes: 36 }], rowCount: 1 };
          }
          if (/FROM crm_leads l/i.test(sql) || /crm_am_handovers/i.test(sql) || /crm_am_renewal_cases/i.test(sql)) {
            return { rows: [], rowCount: 0 };
          }
          if (/SET status = 'warning'/i.test(sql)) {
            return { rowCount: 2, rows: [{ id: 'a' }, { id: 'b' }] };
          }
          if (/SET status = 'breached'/i.test(sql)) {
            return { rowCount: 1, rows: [{ id: 'c' }] };
          }
          if (/RevOps SLA reminder/i.test(sql) && /SELECT i.id/i.test(sql)) {
            return { rows: [{ id: 'i1', entity_type: 'lead_first_response', entity_id: '99' }] };
          }
          if (/INSERT INTO crm_lead_activities/i.test(sql)) {
            return { rows: [], rowCount: 1 };
          }
          if (/crm_revops_routing_rules/i.test(sql) && /published/i.test(sql)) {
            return { rows: [{ '?column?': 1 }] };
          }
          if (/FROM crm_staff/i.test(sql)) {
            return { rows: [{ id: 7 }] };
          }
          if (/status = 'breached'/i.test(sql) && /entity_type = 'lead_first_response'/i.test(sql)) {
            return { rows: [{ id: 'i2', entity_type: 'lead_first_response', entity_id: '88', owner_id: 3 }] };
          }
          if (/UPDATE crm_revops_sla_incidents SET owner_id/i.test(sql)) {
            return { rows: [], rowCount: 1 };
          }
          if (/INSERT INTO crm_lead_assignment_log/i.test(sql)) {
            return { rows: [], rowCount: 1 };
          }
          if (/UPDATE crm_leads SET owner_id/i.test(sql)) {
            return { rows: [], rowCount: 1 };
          }
          if (/INSERT INTO crm_revops_sla_incidents/i.test(sql)) {
            return { rows: [], rowCount: 0 };
          }
          if (/SELECT id, entity_type, duration_minutes/i.test(sql)) {
            return { rows: [] };
          }
          return { rows: [], rowCount: 0 };
        }),
    };
  }

  it('transitions warning, breach, reminder, and reassign', async () => {
    const db = mockDb();
    const svc = new RevopsSlaService(db as never);
    const out = await svc.tick(new Date('2026-09-06T10:00:00Z'));
    expect(out.warnings).toBe(2);
    expect(out.breaches).toBe(1);
    expect(out.reminders).toBe(1);
    expect(out.reassignments).toBe(1);
    expect(out.processed).toBe(5);
  });

  it('returns zeros when tables are missing', async () => {
    const db = {
      query: jest.fn().mockRejectedValue({ code: '42P01' }),
    };
    const svc = new RevopsSlaService(db as never);
    await expect(svc.tick()).resolves.toEqual({
      processed: 0,
      warnings: 0,
      breaches: 0,
      reminders: 0,
      reassignments: 0,
    });
  });
});

describe('RevopsSlaService.getCenter', () => {
  it('includes compliance target and breach trend', async () => {
    const db = {
      query: jest.fn().mockImplementation(async (sql: string) => {
        if (/crm_revops_sla_policies/i.test(sql) && /entity_type = \$2/i.test(sql)) {
          return { rows: [{ id: 'p1', duration_minutes: 60, warning_minutes: 36 }] };
        }
        if (/INSERT INTO crm_revops_sla_policies/i.test(sql)) {
          return { rows: [{ id: 'p1', duration_minutes: 60, warning_minutes: 36 }] };
        }
        if (/FROM crm_leads/i.test(sql)) return { rows: [] };
        if (/crm_am_handovers/i.test(sql)) return { rows: [] };
        if (/crm_am_renewal_cases/i.test(sql)) return { rows: [] };
        if (/FROM crm_revops_sla_incidents/i.test(sql) && /status IN/i.test(sql)) {
          return {
            rows: [
              {
                id: '1',
                entity_type: 'lead_first_response',
                entity_id: '10',
                policy_id: 'p1',
                owner_id: 5,
                due_at: '2026-09-06T12:00:00Z',
                breached_at: null,
                status: 'open',
              },
            ],
          };
        }
        if (/ORDER BY name/i.test(sql)) {
          return {
            rows: [
              {
                id: 'p1',
                name: 'Lead 60m',
                entity_type: 'lead_first_response',
                duration_minutes: 60,
                warning_minutes: 36,
                escalate_json: [],
              },
            ],
          };
        }
        if (/breached_at >= now/i.test(sql)) {
          return { rows: [{ day: '2026-09-05', count: 2 }] };
        }
        if (/revops_sla_auto_reassign/i.test(sql)) {
          return { rows: [{ c: 3 }] };
        }
        if (/SELECT id, entity_type, duration_minutes/i.test(sql)) {
          return {
            rows: [
              {
                id: 'p1',
                entity_type: 'lead_first_response',
                duration_minutes: 60,
                warning_minutes: 36,
              },
            ],
          };
        }
        return { rows: [] };
      }),
    };
    const svc = new RevopsSlaService(db as never);
    const out = await svc.getCenter();
    expect(out.kpis.complianceTargetPct).toBe(95);
    expect(out.kpis.autoReassignments).toBe(3);
    expect(out.breachTrend7d).toEqual([{ day: '2026-09-05', count: 2 }]);
    expect(out.incidents[0]?.assignableLeadId).toBe(10);
  });
});
