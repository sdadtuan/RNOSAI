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
  return new ContentOsPortfolioService(repo as never, workflow as never, marketingRepo as never, { createItem: jest.fn() } as never);
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

describe('ContentOsPortfolioService.listRequests', () => {
  it('returns empty items when staffId is missing or zero', async () => {
    const repo = { listScopedLifecycleIds: jest.fn(), listRequests: jest.fn() };
    const svc = makeSvc(repo);
    const out = await svc.listRequests({ staffId: 0 });
    expect(out).toEqual({ items: [] });
    expect(repo.listScopedLifecycleIds).not.toHaveBeenCalled();
    expect(repo.listRequests).not.toHaveBeenCalled();
  });

  it('returns empty items when no lifecycles in scope', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([]), listRequests: jest.fn() };
    const svc = makeSvc(repo);
    const out = await svc.listRequests({ staffId: 1 });
    expect(out).toEqual({ items: [] });
    expect(repo.listRequests).not.toHaveBeenCalled();
  });

  it('returns empty items when requests table is missing', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      listRequests: jest.fn().mockRejectedValue(new Error('relation cmkt_content_requests does not exist')),
    };
    const svc = makeSvc(repo);
    const out = await svc.listRequests({ staffId: 1 });
    expect(out).toEqual({ items: [] });
  });

  it('returns scoped request rows without inventing extras', async () => {
    const row = { id: 9, display_code: 'CR-20260910-001', triage_status: 'Submitted' };
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      listRequests: jest.fn().mockResolvedValue([row]),
    };
    const svc = makeSvc(repo);
    const out = await svc.listRequests({ staffId: 1 });
    expect(out).toEqual({ items: [row] });
    expect(repo.listRequests).toHaveBeenCalledWith([4]);
  });

  it('merges unconverted ideas from scoped lifecycles without inventing clients', async () => {
    const row = { id: 9, display_code: 'CR-20260910-001', triage_status: 'Submitted', client_label: 'Acme' };
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      listRequests: jest.fn().mockResolvedValue([row]),
    };
    const marketingRepo = {
      listIdeas: jest.fn().mockResolvedValue([
        {
          id: 3,
          lifecycle_id: 4,
          title: 'Hook idea',
          status: 'backlog',
          target_goal: 'Reach',
          created_by: 'am@ptt.vn',
          created_at: '2026-09-10T00:00:00.000Z',
          updated_at: '2026-09-10T00:00:00.000Z',
        },
        { id: 4, lifecycle_id: 4, title: 'Done', status: 'converted' },
        { id: 5, lifecycle_id: 4, title: 'Old', status: 'archived' },
      ]),
    };
    const svc = makeSvc(repo, undefined, marketingRepo);
    const out = await svc.listRequests({ staffId: 1 });

    expect(out.items).toHaveLength(2);
    expect(out.items[0]).toEqual(row);
    expect(out.items[1]).toEqual(
      expect.objectContaining({
        kind: 'idea',
        source: 'idea',
        idea_id: 3,
        deliverable_ask: 'Hook idea',
        lifecycle_id: 4,
        client_label: '',
        brand_label: '',
        triage_status: 'backlog',
      }),
    );
    expect(out.items.map((item) => item.client_label)).toEqual(['Acme', '']);
    expect(marketingRepo.listIdeas).toHaveBeenCalledWith(4, {});
  });

  it('adds no extra rows when scoped ideas are empty', async () => {
    const row = { id: 9, display_code: 'CR-20260910-001', triage_status: 'Submitted' };
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      listRequests: jest.fn().mockResolvedValue([row]),
    };
    const marketingRepo = { listIdeas: jest.fn().mockResolvedValue([]) };
    const svc = makeSvc(repo, undefined, marketingRepo);
    const out = await svc.listRequests({ staffId: 1 });
    expect(out).toEqual({ items: [row] });
  });

  it('skips a lifecycle when listIdeas throws', async () => {
    const row = { id: 9, display_code: 'CR-20260910-001', triage_status: 'Submitted' };
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4, 7]),
      listRequests: jest.fn().mockResolvedValue([row]),
    };
    const marketingRepo = {
      listIdeas: jest
        .fn()
        .mockRejectedValueOnce(new Error('lifecycle_disabled'))
        .mockResolvedValueOnce([
          { id: 8, lifecycle_id: 7, title: 'Keep', status: 'backlog' },
        ]),
    };
    const svc = makeSvc(repo, undefined, marketingRepo);
    const out = await svc.listRequests({ staffId: 1 });
    expect(out.items).toHaveLength(2);
    expect(out.items[1]).toEqual(
      expect.objectContaining({ kind: 'idea', source: 'idea', idea_id: 8, deliverable_ask: 'Keep' }),
    );
    expect(marketingRepo.listIdeas).toHaveBeenCalledTimes(2);
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

