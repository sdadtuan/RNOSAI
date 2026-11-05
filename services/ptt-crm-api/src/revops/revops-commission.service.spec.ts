import { RevopsCommissionService } from './revops-commission.service';

describe('RevopsCommissionService.getSummary', () => {
  it('aggregates transaction totals by status', async () => {
    const db = {
      query: jest.fn().mockResolvedValue({
        rows: [
          { status: 'pending_collection', total: '1000000' },
          { status: 'approved', total: '500000' },
          { status: 'clawback', total: '-200000' },
        ],
      }),
    };
    const svc = new RevopsCommissionService(db as never);
    const out = await svc.getSummary();
    expect(out.pendingVnd).toBe(800000);
    expect(out.approvedVnd).toBe(500000);
    expect(out.estimatedVnd).toBe(1300000);
  });

  it('returns nulls when table is missing', async () => {
    const db = {
      query: jest.fn().mockRejectedValue({ code: '42P01' }),
    };
    const svc = new RevopsCommissionService(db as never);
    await expect(svc.getSummary()).resolves.toEqual({
      estimatedVnd: null,
      approvedVnd: null,
      pendingVnd: null,
    });
  });
});

describe('RevopsCommissionService.getHub', () => {
  it('composes hub payload with projections and staff rows', async () => {
    const db = {
      query: jest.fn().mockImplementation(async (sql: string) => {
        if (/GROUP BY status/i.test(sql)) {
          return { rows: [{ status: 'approved', total: '1000000' }] };
        }
        if (/FROM crm_revops_commission_plans/i.test(sql)) {
          return {
            rows: [
              {
                id: 'p1',
                name: 'Plan AE',
                version: 1,
                effective_from: '2026-01-01',
                effective_to: null,
                revenue_basis: 'collected',
                role_code: 'ae',
                status: 'published',
              },
            ],
          };
        }
        if (/FROM crm_revops_commission_tiers/i.test(sql)) {
          return { rows: [{ id: 't1', min_attainment_pct: 0, max_attainment_pct: null, rate_pct: 5 }] };
        }
        if (/GROUP BY t.staff_id/i.test(sql)) {
          return {
            rows: [
              {
                staff_id: 3,
                name: 'Alice',
                estimated_vnd: '500000',
                approved_vnd: '500000',
                pending_vnd: '0',
                transaction_count: 1,
              },
            ],
          };
        }
        if (/FROM crm_revops_commission_transactions/i.test(sql) && /ORDER BY created_at/i.test(sql)) {
          return {
            rows: [
              {
                id: 'tx1',
                deal_ref: 'NEW-001',
                staff_id: 3,
                eligible_vnd: 10000000,
                rate_pct: 5,
                split_pct: 100,
                commission_vnd: 500000,
                status: 'approved',
                payout_batch_id: null,
                created_at: '2026-09-01T00:00:00Z',
              },
            ],
          };
        }
        if (/FROM crm_revops_payout_batches/i.test(sql)) {
          return {
            rows: [{ id: 'b1', period: '2026-09', status: 'draft', locked_at: null, created_at: '2026-09-01' }],
          };
        }
        return { rows: [] };
      }),
      withTransaction: undefined,
    };
    const svc = new RevopsCommissionService(db as never);
    const out = await svc.getHub();
    expect(out.weights.newPct).toBe(45);
    expect(out.projections.newVnd).toBe(500000);
    expect(out.staffRows[0]?.name).toBe('Alice');
    expect(out.activePlan?.name).toBe('Plan AE');
    expect(out.payoutBatches).toHaveLength(1);
  });
});
