import { BadRequestException } from '@nestjs/common';
import { kpiHubMemory } from '../kpi-hub/kpi-hub.memory-store';
import { DeliveryProjectsService } from './delivery-projects.service';

describe('DeliveryProjectsService.create', () => {
  function makeSvc(overrides: Partial<{
    repo: Record<string, unknown>;
    budgetRepo: Record<string, unknown>;
    b2b: Record<string, unknown>;
    kpisRepo: Record<string, unknown>;
    targets: Record<string, unknown>;
  }> = {}) {
    const repo = {
      insertHeader: jest.fn(),
      listPrjCodes: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue({ id: 'd1', capabilities: ['delivery'] }),
      upsertWizardDraft: jest.fn(),
      patchHeader: jest.fn().mockResolvedValue({ id: 'd1', status: 'pending_approval' }),
      ...overrides.repo,
    };
    const budgetRepo = {
      listItems: jest.fn().mockResolvedValue([]),
      getProjectBudgetHeader: jest.fn().mockResolvedValue(null),
      recalcProjectBudget: jest.fn(),
      previewImpact: jest.fn(),
      insertItem: jest.fn(),
      ...overrides.budgetRepo,
    };
    const kpisRepo = {
      list: jest.fn().mockResolvedValue([]),
      listDictionaryIds: jest.fn().mockResolvedValue([]),
      addMany: jest.fn().mockResolvedValue([]),
      ...overrides.kpisRepo,
    };
    const targets = {
      upsert: jest.fn().mockResolvedValue({ id: 't1' }),
      ...overrides.targets,
    };
    return new DeliveryProjectsService(
      repo as never,
      budgetRepo as never,
      (overrides.b2b ?? { create: jest.fn() }) as never,
      kpisRepo as never,
      targets as never,
    );
  }

  it('rejects empty capabilities', async () => {
    const svc = makeSvc();
    await expect(svc.create({ name: 'X', capabilities: [] }, 1, true)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('creates b2b facet then header when lead_ingest is on', async () => {
    const b2b = { create: jest.fn().mockResolvedValue({ id: 'b2b-1', code: 'an-gia', status: 'draft' }) };
    const repo = {
      listPrjCodes: jest.fn().mockResolvedValue([]),
      insertHeader: jest.fn().mockResolvedValue({ id: 'd1', code: null, capabilities: ['lead_ingest'] }),
    };
    const svc = makeSvc({ repo, b2b });
    await svc.create({ name: 'An Gia', capabilities: ['lead_ingest'], b2b: { code: 'an-gia' } }, 9, true);
    expect(b2b.create).toHaveBeenCalled();
    expect(repo.insertHeader).toHaveBeenCalledWith(
      expect.objectContaining({ b2b_project_id: 'b2b-1', code: null, capabilities: ['lead_ingest'] }),
    );
  });

  it('assigns PRJ code when delivery is on', async () => {
    const repo = {
      listPrjCodes: jest.fn().mockResolvedValue(['PRJ-001']),
      insertHeader: jest.fn().mockResolvedValue({ id: 'd2', code: 'PRJ-002' }),
    };
    const svc = makeSvc({ repo });
    await svc.create({ name: 'Deliv', capabilities: ['delivery'], pm_staff_id: 1 }, 1, true);
    expect(repo.insertHeader).toHaveBeenCalledWith(expect.objectContaining({ code: 'PRJ-002' }));
  });
});

describe('DeliveryProjectsService.attachKpis', () => {
  it('rejects deprecated dictionary KPIs', async () => {
    const active = kpiHubMemory.dictionary[0];
    const originalStatus = active.status;
    active.status = 'DEPRECATED';
    const svc = new DeliveryProjectsService(
      { getById: jest.fn().mockResolvedValue({ id: 'p1' }) } as never,
      {} as never,
      {} as never,
      { listDictionaryIds: jest.fn().mockResolvedValue([]), addMany: jest.fn() } as never,
      { upsert: jest.fn() } as never,
    );
    try {
      await expect(svc.attachKpis('p1', { dictionary_ids: [active.id] })).rejects.toMatchObject({
        response: { error: 'KPI_DEPRECATED' },
      });
    } finally {
      active.status = originalStatus;
    }
  });
});

describe('DeliveryProjectsService.createBudgetItem', () => {
  it('rejects media without media_borne', async () => {
    const svc = new DeliveryProjectsService(
      { getById: jest.fn().mockResolvedValue({ id: 'p1' }) } as never,
      { insertItem: jest.fn(), recalcProjectBudget: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      svc.createBudgetItem('p1', {
        name: 'Media',
        kind: 'media',
        approved_budget: '100',
        forecast: '100',
      }),
    ).rejects.toMatchObject({ response: { error: 'media_borne_required' } });
  });

  it('margin 25% submit sets pending_approval with needs_finance', async () => {
    const budgetRepo = {
      recalcProjectBudget: jest.fn(),
      getProjectBudgetHeader: jest.fn().mockResolvedValue({
        gross_margin_pct: '25',
        forecast_cost: '110',
        internal_cost_budget: '100',
        finance_policy_json: { min_gross_margin_pct: 30 },
      }),
      submitProject: jest.fn(),
    };
    const repo = {
      getById: jest.fn().mockResolvedValue({ id: 'p1' }),
      upsertWizardDraft: jest.fn(),
      patchHeader: jest.fn().mockResolvedValue({ id: 'p1', status: 'pending_approval' }),
    };
    const kpisRepo = { list: jest.fn().mockResolvedValue([{ id: 'k1' }]) };
    const svc = new DeliveryProjectsService(
      repo as never,
      budgetRepo as never,
      {} as never,
      kpisRepo as never,
      {} as never,
    );
    const out = await svc.submit(
      'p1',
      {
        checklist: { scope_confirmed: true, budget_confirmed: true, kpi_confirmed: true },
      },
      { crm_delivery_budget: ['view'] },
    );
    expect(out.needs_finance).toBe(true);
    expect(budgetRepo.submitProject).toHaveBeenCalledWith('p1', {
      status: 'pending_approval',
      needs_finance: true,
    });
  });
});
