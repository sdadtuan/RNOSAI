import { ContentOsPortfolioService } from './content-os-portfolio.service';

describe('ContentOsPortfolioService.getCommandCenter', () => {
  it('returns zeros and empty queue when no lifecycles in scope', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([]), aggregateCommand: jest.fn() };
    const svc = new ContentOsPortfolioService(repo as never);
    const out = await svc.getCommandCenter({ staffId: 1 });
    expect(out.throughput_week).toBe(0);
    expect(out.wip).toBe(0);
    expect(out.risk_queue).toEqual([]);
    expect(out.capacity_pct).toBeNull();
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
    const svc = new ContentOsPortfolioService(repo as never);
    const out = await svc.getCommandCenter({ staffId: 1 });
    expect(out.capacity_pct).toBeNull();
    expect(out.throughput_week).toBe(4);
  });
});
