import { ContentOsPortfolioService } from './content-os-portfolio.service';

describe('listChannelAccounts', () => {
  it('maps connector_id onto public items without tokens', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      listChannelAccountsPublic: jest.fn().mockResolvedValue([
        {
          id: 1,
          channel: 'facebook_page',
          display_name: 'PTT Ads',
          account_ref: '555',
          connector_id: 9,
          status: 'on',
          expires_at: '2026-12-01T00:00:00.000Z',
        },
      ]),
    };
    const svc = new ContentOsPortfolioService(repo as never, {} as never, {} as never, {} as never);
    const out = await svc.listChannelAccounts({ staffId: 7 });
    expect(repo.listChannelAccountsPublic).toHaveBeenCalledWith([4]);
    expect(out.items[0]).toEqual(
      expect.objectContaining({
        id: 1,
        channel: 'facebook_page',
        display_name: 'PTT Ads',
        account_ref: '555',
        connector_id: 9,
      }),
    );
    expect(JSON.stringify(out)).not.toMatch(/access_token|refresh_token/i);
  });
});

describe('disconnectConnector', () => {
  it('sets status off and audits without echoing token', async () => {
    const repo = {
      getConnectorById: jest.fn().mockResolvedValue({ id: 9, channel_account_id: 1, status: 'on' }),
      clearConnectorSecrets: jest.fn().mockResolvedValue({ status: 'off' }),
      insertAuditExport: jest.fn(),
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
    };
    const svc = new ContentOsPortfolioService(repo as never, {} as never, {} as never, {} as never);
    const out = await svc.disconnectConnector({ staffId: 7, connectorId: 9, actor: 'ops@ptt.vn' });
    expect(out).toEqual({ status: 'off' });
    expect(repo.clearConnectorSecrets).toHaveBeenCalledWith(9);
    expect(repo.insertAuditExport).toHaveBeenCalledWith(expect.objectContaining({ action: 'oauth_disconnect' }));
    expect(JSON.stringify(out)).not.toMatch(/token/i);
  });
});
