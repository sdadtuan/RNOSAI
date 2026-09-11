import { ContentOsPortfolioService } from './content-os-portfolio.service';

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
