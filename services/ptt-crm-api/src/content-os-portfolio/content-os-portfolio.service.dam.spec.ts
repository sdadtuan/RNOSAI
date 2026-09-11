import { BadRequestException } from '@nestjs/common';
import { ContentOsPortfolioService } from './content-os-portfolio.service';

function makeSvc() {
  return new ContentOsPortfolioService({} as never, {} as never, {} as never, {} as never);
}

describe('ContentOsPortfolioService listDamAssets', () => {
  const prevDamBase = process.env.CMKT_DAM_BASE_URL;

  afterEach(() => {
    if (prevDamBase === undefined) delete process.env.CMKT_DAM_BASE_URL;
    else process.env.CMKT_DAM_BASE_URL = prevDamBase;
  });

  it('returns empty list plus error from the stub adapter and does not invent DAM assets', async () => {
    delete process.env.CMKT_DAM_BASE_URL;
    const svc = makeSvc();
    const result = await svc.listDamAssets({ staffId: 7, collection: 'approved' });
    expect(result).toEqual({ items: [], error: 'dam_not_configured' });
    expect(JSON.stringify(result)).not.toMatch(/Sunlight|Nova/i);
  });

  it('returns 400 collection_required when collection is missing', async () => {
    const svc = makeSvc();
    await expect(svc.listDamAssets({ staffId: 7 })).rejects.toBeInstanceOf(BadRequestException);
    try {
      await svc.listDamAssets({ staffId: 7, collection: '  ' });
      throw new Error('expected');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual({ error: 'collection_required' });
    }
  });
});
