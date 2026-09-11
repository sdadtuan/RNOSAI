import { ContentOsPortfolioService } from './content-os-portfolio.service';

function makeSvc() {
  return new ContentOsPortfolioService({} as never, {} as never, {} as never, {} as never);
}

describe('ContentOsPortfolioService listDamAssets', () => {
  it('returns empty list plus error from the stub adapter and does not invent DAM assets', async () => {
    const svc = makeSvc();
    const result = await svc.listDamAssets({ staffId: 7, collection: 'approved' });
    expect(result).toEqual({ items: [], error: 'dam_not_configured' });
    expect(JSON.stringify(result)).not.toMatch(/Sunlight|Nova/i);
  });
});
