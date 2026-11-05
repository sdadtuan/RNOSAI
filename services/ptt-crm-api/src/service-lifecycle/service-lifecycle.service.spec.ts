import { ServiceLifecycleService } from './service-lifecycle.service';

describe('ServiceLifecycleService PostgreSQL paths', () => {
  const lifecycle = {
    id: 42,
    lead_id: null,
    customer_id: null,
    contract_id: null,
    service_slug: 'meta-ads',
    stage: 'deliver',
    status: 'active',
    sku_code: null,
    assigned_am: null,
    assigned_sp: null,
    stage_entered_at: '',
    notes: '',
    marketing_plan_id: null,
    sop_run_id: null,
    created_at: '',
    updated_at: '',
  };

  function createService() {
    const pg = {
      getLifecycleById: jest.fn().mockResolvedValue(lifecycle),
      listEvents: jest.fn().mockResolvedValue([{ id: 1 }]),
    };
    const tasks = {
      listTasksGrouped: jest.fn().mockResolvedValue({ deliver: [{ id: 7 }] }),
    };
    const financeConfirms = {
      listForLifecycle: jest.fn().mockResolvedValue([{ id: 9, lifecycle_id: 42 }]),
    };
    const service = new ServiceLifecycleService(
      pg as never,
      tasks as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      financeConfirms as never,
      {} as never,
      {} as never,
    );
    return { service, pg, tasks, financeConfirms };
  }

  it('loads lifecycle detail and events from PostgreSQL', async () => {
    const { service, pg } = createService();

    await expect(service.detail(42)).resolves.toEqual({ ...lifecycle, events: [{ id: 1 }] });
    expect(pg.getLifecycleById).toHaveBeenCalledWith(42);
    expect(pg.listEvents).toHaveBeenCalledWith(42);
  });

  it('loads lifecycle tasks from PostgreSQL', async () => {
    const { service, tasks } = createService();

    await expect(service.listTasks(42)).resolves.toEqual({
      tasks: { deliver: [{ id: 7 }] },
    });
    expect(tasks.listTasksGrouped).toHaveBeenCalledWith(42);
  });

  it('loads finance confirmations from PostgreSQL', async () => {
    const { service, financeConfirms } = createService();

    await expect(service.listFinanceConfirms(42)).resolves.toEqual({
      rows: [{ id: 9, lifecycle_id: 42 }],
    });
    expect(financeConfirms.listForLifecycle).toHaveBeenCalledWith(42);
  });
});
