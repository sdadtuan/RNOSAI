import { ContentOsPortfolioService } from './content-os-portfolio.service';

function stubs() {
  return {
    workflow: { listReviewQueue: jest.fn() },
    marketingRepo: { listCalendarSlots: jest.fn() },
  };
}

function makeSvc(
  repo: object,
  workflow: object = stubs().workflow,
  marketingRepo: object = stubs().marketingRepo,
) {
  return new ContentOsPortfolioService(repo as never, workflow as never, marketingRepo as never);
}

describe('ContentOsPortfolioService.getCommandCenter', () => {
  it('returns zeros and empty queue when no lifecycles in scope', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([]), aggregateCommand: jest.fn() };
    const svc = makeSvc(repo);
    const out = await svc.getCommandCenter({ staffId: 1 });
    expect(out.throughput_week).toBe(0);
    expect(out.wip).toBe(0);
    expect(out.risk_queue).toEqual([]);
    expect(out.capacity_pct).toBeNull();
    expect(repo.aggregateCommand).not.toHaveBeenCalled();
  });

  it('returns empty command center when staffId is missing or zero', async () => {
    const repo = { listScopedLifecycleIds: jest.fn(), aggregateCommand: jest.fn() };
    const svc = makeSvc(repo);
    const out = await svc.getCommandCenter({ staffId: 0 });
    expect(out.throughput_week).toBe(0);
    expect(out.wip).toBe(0);
    expect(out.risk_queue).toEqual([]);
    expect(out.capacity_pct).toBeNull();
    expect(repo.listScopedLifecycleIds).not.toHaveBeenCalled();
    expect(repo.aggregateCommand).not.toHaveBeenCalled();
  });

  it('does not invent capacity when repo returns null', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([3]),
      aggregateCommand: jest.fn().mockResolvedValue({
        throughput_week: 4,
        completed_week: 2,
        wip: 2,
        sla_at_risk: 1,
        sla_breached: 0,
        first_pass_pct: null,
        capacity_pct: null,
        blocked: 1,
        risk_queue: [],
      }),
    };
    const svc = makeSvc(repo);
    const out = await svc.getCommandCenter({ staffId: 1 });
    expect(out.capacity_pct).toBeNull();
    expect(out.throughput_week).toBe(4);
  });
});

describe('ContentOsPortfolioService.listApprovals', () => {
  it('returns empty items when no lifecycles in scope', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([]) };
    const workflow = { listReviewQueue: jest.fn() };
    const svc = makeSvc(repo, workflow);
    const out = await svc.listApprovals({ staffId: 1 });
    expect(out).toEqual({ items: [] });
    expect(workflow.listReviewQueue).not.toHaveBeenCalled();
  });

  it('unions review-queue items and skips a throwing lifecycle', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([2, 3]) };
    const workflow = {
      listReviewQueue: jest
        .fn()
        .mockResolvedValueOnce({ items: [{ id: 10 }] })
        .mockRejectedValueOnce(new Error('lifecycle_disabled')),
    };
    const svc = makeSvc(repo, workflow);
    const out = await svc.listApprovals({ staffId: 1 });
    expect(out.items).toEqual([{ id: 10 }]);
    expect(workflow.listReviewQueue).toHaveBeenCalledWith(2, {});
    expect(workflow.listReviewQueue).toHaveBeenCalledWith(3, {});
  });

  it('caps scoped lifecycle ids at 20', async () => {
    const ids = Array.from({ length: 25 }, (_, i) => i + 1);
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue(ids) };
    const workflow = { listReviewQueue: jest.fn().mockResolvedValue({ items: [] }) };
    const svc = makeSvc(repo, workflow);
    await svc.listApprovals({ staffId: 1 });
    expect(workflow.listReviewQueue).toHaveBeenCalledTimes(20);
  });
});

describe('ContentOsPortfolioService.listPublications', () => {
  it('returns empty slots when no lifecycles in scope', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([]) };
    const marketingRepo = { listCalendarSlots: jest.fn() };
    const svc = makeSvc(repo, undefined, marketingRepo);
    const out = await svc.listPublications({ staffId: 1, from: '2026-09-07', to: '2026-09-13' });
    expect(out).toEqual({ slots: [] });
    expect(marketingRepo.listCalendarSlots).not.toHaveBeenCalled();
  });

  it('uses current ISO week (Mon–Sun) when from/to omitted', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([4]) };
    const marketingRepo = { listCalendarSlots: jest.fn().mockResolvedValue([]) };
    const svc = makeSvc(repo, undefined, marketingRepo);
    await svc.listPublications({ staffId: 1 });
    expect(marketingRepo.listCalendarSlots).toHaveBeenCalledTimes(1);
    const range = marketingRepo.listCalendarSlots.mock.calls[0][1] as { from: string; to: string };
    const from = new Date(range.from);
    const to = new Date(range.to);
    expect(from.getUTCDay()).toBe(1);
    expect(to.getUTCDay()).toBe(0);
    expect(to.getTime()).toBeGreaterThan(from.getTime());
  });
});

