import { ContentOsPortfolioService } from './content-os-portfolio.service';

function makeSvc(repo: object, marketingRepo: object) {
  return new ContentOsPortfolioService(repo as never, {} as never, marketingRepo as never, {} as never);
}

function slaRow(partial: { id: number; item_id: number; am_staff_id?: number | null; action?: string }) {
  return {
    id: partial.id,
    item_id: partial.item_id,
    task_id: 'copy',
    threshold: 100,
    action: partial.action ?? 'breached',
    am_staff_id: partial.am_staff_id ?? 11,
    created_at: '2026-09-11T10:06:00.000Z',
  };
}

describe('ContentOsPortfolioService.listSlaEvents', () => {
  it('returns empty when staff has no scoped lifecycles', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([]) };
    const marketingRepo = { listSlaAudits: jest.fn(), findItemById: jest.fn() };
    const svc = makeSvc(repo, marketingRepo);
    await expect(svc.listSlaEvents({ staffId: 9 })).resolves.toEqual({ items: [] });
    expect(marketingRepo.listSlaAudits).not.toHaveBeenCalled();
  });

  it('calls listSlaAudits with optional item_id and am_staff_id', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([4]) };
    const marketingRepo = {
      listSlaAudits: jest.fn().mockResolvedValue([]),
      findItemById: jest.fn().mockResolvedValue({ id: 21, lifecycle_id: 4 }),
    };
    const svc = makeSvc(repo, marketingRepo);
    await expect(svc.listSlaEvents({ staffId: 9, itemId: 21, amStaffId: 11 })).resolves.toEqual({ items: [] });
    expect(marketingRepo.listSlaAudits).toHaveBeenCalledWith({ item_id: 21, am_staff_id: 11 });
  });

  it('returns empty when item_id is outside board lifecycle scope', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([4]) };
    const marketingRepo = {
      listSlaAudits: jest.fn(),
      findItemById: jest.fn().mockResolvedValue({ id: 99, lifecycle_id: 88 }),
    };
    const svc = makeSvc(repo, marketingRepo);
    await expect(svc.listSlaEvents({ staffId: 9, itemId: 99 })).resolves.toEqual({ items: [] });
    expect(marketingRepo.listSlaAudits).not.toHaveBeenCalled();
  });

  it('drops events whose items are outside board lifecycle scope', async () => {
    const inScope = slaRow({ id: 1, item_id: 21 });
    const leaked = slaRow({ id: 2, item_id: 99, am_staff_id: 22 });
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([4]) };
    const marketingRepo = {
      listSlaAudits: jest.fn().mockResolvedValue([inScope, leaked]),
      findItemById: jest.fn(async (id: number) =>
        id === 21 ? { id: 21, lifecycle_id: 4 } : { id: 99, lifecycle_id: 88 },
      ),
    };
    const svc = makeSvc(repo, marketingRepo);
    const out = await svc.listSlaEvents({ staffId: 9 });
    expect(out.items).toEqual([inScope]);
  });
});
