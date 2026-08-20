import { VdCostService } from './vd-cost.service';

describe('VdCostService', () => {
  const config = { contentMarketingVideoCinematicEnabled: true } as never;
  let projects: { getById: jest.Mock };
  let costs: {
    getBudget: jest.Mock;
    upsertBudget: jest.Mock;
    sumByKind: jest.Mock;
    insertLedger: jest.Mock;
    listLedger: jest.Mock;
  };
  let service: VdCostService;

  beforeEach(() => {
    projects = {
      getById: jest.fn().mockResolvedValue({ id: 1, status: 'active', stage: 'animating' }),
    };
    costs = {
      getBudget: jest.fn().mockResolvedValue({
        project_id: 1,
        currency: 'USD',
        limit_amount: 10,
        buffer_factor: 1.5,
        overshoot_factor: 2.5,
        alert_threshold: 100,
        updated_at: new Date().toISOString(),
      }),
      upsertBudget: jest.fn(),
      sumByKind: jest.fn().mockImplementation(async (_pid: number, kind: string) => {
        if (kind === 'estimated') return 0;
        return 0;
      }),
      insertLedger: jest.fn().mockResolvedValue({
        id: 1,
        project_id: 1,
        job_id: null,
        kind: 'estimated',
        amount: 5,
        vendor: 'q.image',
        created_at: new Date().toISOString(),
      }),
      listLedger: jest.fn().mockResolvedValue([]),
    };
    service = new VdCostService(config, projects as never, costs as never);
  });

  it('rejects reserve over buffer', async () => {
    await expect(service.reserve(1, 20)).rejects.toThrow(/budget_exceeded/);
  });

  it('records estimated reserve under cap', async () => {
    const row = await service.reserve(1, 5, { vendor: 'q.image' });
    expect(row.kind).toBe('estimated');
    expect(costs.insertLedger).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: 1, kind: 'estimated', amount: 5 }),
    );
  });

  it('blocks accounting export when project not closed', async () => {
    await expect(service.exportXlsx(1, true)).rejects.toThrow(/project_not_closed/);
  });

  it('exports xlsx when project archived with close=1', async () => {
    projects.getById.mockResolvedValue({ id: 1, status: 'active', stage: 'archived' });
    costs.listLedger.mockResolvedValue([
      {
        id: 1,
        project_id: 1,
        job_id: null,
        kind: 'estimated',
        amount: 5,
        vendor: 'q.image',
        created_at: '2026-08-20T00:00:00.000Z',
      },
    ]);
    const buf = await service.exportXlsx(1, true);
    expect(buf.slice(0, 2).toString('utf8')).toBe('PK');
  });

  it('sets warn90 when actual exceeds 90% of limit', async () => {
    costs.sumByKind.mockImplementation(async (_pid: number, kind: string) =>
      kind === 'actual' ? 9.5 : 0,
    );
    const view = await service.getBudget(1);
    expect(view.warnings.warn90).toBe(true);
    expect(view.warnings.warn70).toBe(true);
  });
});
