import { AmPlansService } from './am-plans.service';
import { AmRisksService } from './am-risks.service';

const CLIENT_ID = '19d722af-0000-4000-8000-000000000001';

describe('AmPlansService', () => {
  const repo = {
    insert: jest.fn(),
    deleteById: jest.fn(),
  };
  const tasks = {
    create: jest.fn(),
  };
  type QueryFn = (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
  const risksDb: { query: jest.MockedFunction<QueryFn> } = {
    query: jest.fn(async (_sql: string) => ({ rows: [], rowCount: 0 })),
  };

  let plans: AmPlansService;
  let risks: AmRisksService;

  beforeEach(() => {
    jest.clearAllMocks();
    risks = new AmRisksService(risksDb as never, {} as never, { insert: jest.fn() } as never);
    plans = new AmPlansService(repo as never, tasks as never, undefined, risks);
  });

  it('renewal plan without contract_id is 400', async () => {
    await expect(plans.create({ agency_client_id: 'c', kind: 'renewal', period_key: '2026-Q3' }, 1))
      .rejects.toMatchObject({ error: 'contract_required' });
  });

  it.each([0, '', '0'])('renewal plan with contract_id %j is 400 contract_required', async (contractId) => {
    await expect(
      plans.create(
        {
          agency_client_id: 'c',
          kind: 'renewal',
          period_key: '2026-Q3',
          contract_id: contractId as never,
        },
        1,
      ),
    ).rejects.toMatchObject({ error: 'contract_required' });
  });

  it('deletes the plan when seed tasks fail so retry is not 409-stuck', async () => {
    const plan = {
      id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      agency_client_id: '19d722af-0000-4000-8000-000000000001',
      contract_id: null,
      kind: 'care' as const,
      period_key: '2026-Q3',
      status: 'open',
      owner_staff_id: 1,
      due_on: null,
    };
    repo.insert.mockResolvedValue(plan);
    tasks.create.mockRejectedValue(new Error('seed fail'));

    await expect(
      plans.create(
        {
          agency_client_id: '19d722af-0000-4000-8000-000000000001',
          kind: 'care',
          period_key: '2026-Q3',
        },
        1,
      ),
    ).rejects.toThrow('seed fail');

    expect(repo.deleteById).toHaveBeenCalledWith(plan.id);
  });

  it('rejects care plan with 409 recovery_required when Critical and no open recovery', async () => {
    risksDb.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (/crm_am_health_snapshots/i.test(text)) {
        return { rows: [{ band: 'critical', override_band: null, override_until: null }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(
      plans.create({ agency_client_id: CLIENT_ID, kind: 'care', period_key: '2026-Q3' }, 1),
    ).rejects.toMatchObject({ status: 409, error: 'recovery_required' });
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('allows care plan when an open recovery exists', async () => {
    const plan = {
      id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      agency_client_id: CLIENT_ID,
      contract_id: null,
      kind: 'care' as const,
      period_key: '2026-Q3',
      status: 'open',
      owner_staff_id: 1,
      due_on: null,
    };
    repo.insert.mockResolvedValue(plan);
    tasks.create.mockResolvedValue({ id: 'task-1' });
    risksDb.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (/crm_am_health_snapshots/i.test(text)) {
        return { rows: [{ band: 'critical', override_band: null, override_until: null }], rowCount: 1 };
      }
      if (/crm_am_recovery_plans/i.test(text)) {
        return { rows: [{ id: 'rec-1' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(
      plans.create({ agency_client_id: CLIENT_ID, kind: 'care', period_key: '2026-Q3' }, 1),
    ).resolves.toMatchObject({ id: plan.id, kind: 'care' });
    expect(repo.insert).toHaveBeenCalled();
  });
});
