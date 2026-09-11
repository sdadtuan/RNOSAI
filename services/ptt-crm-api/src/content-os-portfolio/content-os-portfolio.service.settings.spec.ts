import { stubPublishConnector } from './publish-connector';
import { ContentOsPortfolioService } from './content-os-portfolio.service';

function makeSvc(repo: object, marketingRepo: object = {}) {
  return new ContentOsPortfolioService(repo as never, {} as never, marketingRepo as never, {} as never);
}

describe('ContentOsPortfolioService settings', () => {
  it('GET settings returns direct_social_publish false when the row is missing', async () => {
    const repo = { getSetting: jest.fn().mockResolvedValue(null) };
    const svc = makeSvc(repo);
    await expect(svc.getSettings({ staffId: 7 })).resolves.toEqual({ direct_social_publish: false });
    expect(repo.getSetting).toHaveBeenCalledWith('direct_social_publish');
  });

  it('PATCH settings persists the stored boolean and GET reads it back', async () => {
    const stored = { key: 'direct_social_publish', value_json: true };
    const repo = {
      getSetting: jest.fn().mockResolvedValue(stored),
      upsertSetting: jest.fn().mockResolvedValue(stored),
    };
    const svc = makeSvc(repo);
    const patched = await svc.patchSettings({
      staffId: 7,
      actor: 'admin@ptt.vn',
      body: { direct_social_publish: true },
    });
    expect(repo.upsertSetting).toHaveBeenCalledWith('direct_social_publish', true, 'admin@ptt.vn');
    expect(patched).toEqual({ direct_social_publish: true });
    await expect(svc.getSettings({ staffId: 7 })).resolves.toEqual({ direct_social_publish: true });
  });

  it('does not publish through the stub when the admin flag is on', async () => {
    const repo = {
      getSetting: jest.fn().mockResolvedValue({ key: 'direct_social_publish', value_json: true }),
    };
    const svc = makeSvc(repo);
    const settings = await svc.getSettings({ staffId: 7 });
    const connector = stubPublishConnector(settings);
    await expect(connector.publish({ item_id: 21, channel: 'facebook' })).rejects.toMatchObject({
      name: 'NotEnabledError',
    });
  });
});
