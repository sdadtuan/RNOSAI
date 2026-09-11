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

describe('ContentOsPortfolioService bindDamAsset', () => {
  const prevDamBase = process.env.CMKT_DAM_BASE_URL;
  const item = { id: 21, lifecycle_id: 4, media_json: {}, production_json: {}, body_json: {} };

  afterEach(() => {
    if (prevDamBase === undefined) delete process.env.CMKT_DAM_BASE_URL;
    else process.env.CMKT_DAM_BASE_URL = prevDamBase;
  });

  function makeBindSvc() {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      insertDamBinding: jest.fn().mockResolvedValue({
        id: 1,
        item_id: 21,
        dam_id: 'a1',
        url: 'https://dam.example.internal/a.jpg',
      }),
      mergeItemDamMediaRef: jest.fn().mockResolvedValue({
        dam_refs: [{ dam_id: 'a1', url: 'https://dam.example.internal/a.jpg' }],
      }),
      insertAuditExport: jest.fn(),
    };
    const marketingRepo = {
      findItemById: jest.fn().mockResolvedValue(item),
      listAssetRights: jest.fn().mockResolvedValue([]),
      replaceAssetRights: jest.fn().mockResolvedValue([]),
    };
    const svc = new ContentOsPortfolioService(
      repo as never,
      {} as never,
      marketingRepo as never,
      { getItem: jest.fn().mockResolvedValue(item) } as never,
    );
    return { svc, repo, marketingRepo };
  }

  it('binds an allowlisted https ref and merges media_json without binary', async () => {
    process.env.CMKT_DAM_BASE_URL = 'https://dam.example.internal/files';
    const { svc, repo, marketingRepo } = makeBindSvc();
    const out = await svc.bindDamAsset({
      staffId: 7,
      itemId: 21,
      actor: 'ops@ptt.vn',
      body: { dam_id: 'a1', url: 'https://dam.example.internal/a.jpg' },
    });
    expect(repo.insertDamBinding).toHaveBeenCalledWith({
      itemId: 21,
      damId: 'a1',
      url: 'https://dam.example.internal/a.jpg',
      rightsJson: null,
    });
    expect(repo.mergeItemDamMediaRef).toHaveBeenCalledWith({
      itemId: 21,
      dam_id: 'a1',
      url: 'https://dam.example.internal/a.jpg',
    });
    expect(JSON.stringify(out)).not.toMatch(/binary|base64|storage_key/i);
    expect(out.media_json.dam_refs).toEqual([{ dam_id: 'a1', url: 'https://dam.example.internal/a.jpg' }]);
    expect(marketingRepo.replaceAssetRights).toHaveBeenCalledWith(21, [
      expect.objectContaining({ asset_ref: 'https://dam.example.internal/a.jpg', status: 'Unknown' }),
    ]);
    expect(repo.insertAuditExport).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'dam_bind', entity: 'dam:dam.example.internal/a.jpg' }),
    );
  });

  it('rejects javascript and foreign hosts as dam_invalid_response', async () => {
    process.env.CMKT_DAM_BASE_URL = 'https://dam.example.internal/';
    const { svc, repo } = makeBindSvc();
    await expect(
      svc.bindDamAsset({
        staffId: 7,
        itemId: 21,
        actor: 'ops@ptt.vn',
        body: { dam_id: 'x', url: 'javascript:alert(1)' },
      }),
    ).rejects.toMatchObject({ response: { error: 'dam_invalid_response' } });
    await expect(
      svc.bindDamAsset({
        staffId: 7,
        itemId: 21,
        actor: 'ops@ptt.vn',
        body: { dam_id: 'x', url: 'https://evil.example/a.jpg' },
      }),
    ).rejects.toMatchObject({ response: { error: 'dam_invalid_response' } });
    expect(repo.insertDamBinding).not.toHaveBeenCalled();
  });
});
