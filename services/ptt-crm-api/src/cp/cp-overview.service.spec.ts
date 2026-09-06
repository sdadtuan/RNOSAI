import { makeOverview, renderSuccessRate } from './cp-overview.service';

describe('CpOverviewService', () => {
  it('returns null KPIs when no rows in scope', async () => {
    const svc = makeOverview({ projects: [], jobs: [], ledger: [], assets: [], tasks: [] });
    const out = await svc.getKpis({ scope: 'me', staffId: 1 });
    expect(out.kpis.videos_created).toBeNull();
    expect(out.last_updated).toMatch(/T/);
  });

  it('render success is completed/(completed+failed) ignoring cancelled', () => {
    expect(renderSuccessRate({ completed: 9, failed: 1, cancelled: 3 })).toBe(0.9);
    expect(renderSuccessRate({ completed: 0, failed: 0, cancelled: 2 })).toBeNull();
  });
});
