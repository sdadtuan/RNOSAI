import { ContentMarketingRepository } from '../content-marketing/content-marketing.repository';
import { ContentOsPortfolioRepository } from './content-os-portfolio.repository';
import { isConnectorEnabled } from './channel-health.util';

function makeMarketingRepo(query: jest.Mock) {
  const repo = new ContentMarketingRepository({ databaseUrl: 'postgres://test' } as never);
  Object.assign(repo, { pool: { query }, pgReady: true });
  return repo;
}

function makePortfolioRepo(query: jest.Mock) {
  const repo = new ContentOsPortfolioRepository({ databaseUrl: 'postgres://test' } as never);
  Object.assign(repo, { pool: { query }, pgReady: true });
  return repo;
}

describe('ContentMarketingRepository.listChannelConnectors', () => {
  it('returns empty when the connectors table is missing', async () => {
    const query = jest
      .fn()
      .mockRejectedValue(Object.assign(new Error('relation "cmkt_connectors" does not exist'), { code: '42P01' }));
    const repo = makeMarketingRepo(query);
    await expect(repo.listChannelConnectors()).resolves.toEqual([]);
    expect(query).toHaveBeenCalled();
  });

  it('selects channel and expiry only — never token columns', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          channel: 'facebook',
          expires_at: '2026-12-01T00:00:00.000Z',
        },
      ],
    });
    const repo = makeMarketingRepo(query);
    const rows = await repo.listChannelConnectors();
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toMatch(/FROM cmkt_connectors/);
    expect(sql).not.toMatch(/access_token|refresh_token|secret_json/i);
    expect(rows).toEqual([
      expect.objectContaining({ channel: 'facebook', expires_at: '2026-12-01T00:00:00.000Z' }),
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/token|secret/i);
  });

  it('orders connectors by enabled, expiry, then id so health pick is deterministic', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repo = makeMarketingRepo(query);
    await repo.listChannelConnectors();
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toMatch(/ORDER BY/i);
    expect(sql).toMatch(/enabled/i);
    expect(sql).toMatch(/expires_at/i);
    expect(sql).toMatch(/\bid\b/i);
  });

  it("computes enabled as status = 'on' allowlist — status 'disabled' is not enabled", async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          id: 4,
          channel: 'facebook',
          status: 'disabled',
          enabled: true,
          expires_at: '2026-12-01T00:00:00.000Z',
        },
      ],
    });
    const repo = makeMarketingRepo(query);
    const rows = await repo.listChannelConnectors();
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toMatch(/\(status = 'on'\)\s+AS enabled/i);
    expect(sql).not.toMatch(/IS DISTINCT FROM\s+'off'/i);
    expect(rows).toEqual([
      expect.objectContaining({ channel: 'facebook', enabled: false }),
    ]);
  });

  it("keeps a database-shaped row with status='on' enabled after mapping", async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          id: 4,
          channel: 'facebook',
          status: 'on',
          enabled: true,
          expires_at: '2026-12-01T00:00:00.000Z',
        },
      ],
    });
    const repo = makeMarketingRepo(query);
    const rows = await repo.listChannelConnectors();
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toMatch(/SELECT[\s\S]*\bstatus\b[\s\S]*\(status = 'on'\)/i);
    expect(sql).not.toMatch(/access_token|refresh_token|secret_json/i);
    expect(rows).toEqual([
      expect.objectContaining({
        channel: 'facebook',
        status: 'on',
        enabled: true,
      }),
    ]);
    expect(isConnectorEnabled(rows[0])).toBe(true);
  });
});

describe('listChannelAccountsPublic SQL', () => {
  it('never selects access_token or refresh_token', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{ id: 1, channel: 'facebook_page', display_name: 'PTT Ads', account_ref: '555' }],
    });
    const repo = makePortfolioRepo(query);
    await repo.listChannelAccountsPublic([4]);
    const sql = String(query.mock.calls[0][0]);
    expect(sql).not.toMatch(/access_token|refresh_token/i);
  });

  it('joins scoped channel accounts with connectors and returns health fields only', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          id: 1,
          channel: 'facebook_page',
          display_name: 'PTT Ads',
          account_ref: '555',
          connector_id: 9,
          status: 'on',
          expires_at: '2026-12-01T00:00:00.000Z',
        },
      ],
    });
    const repo = makePortfolioRepo(query);
    const rows = await repo.listChannelAccountsPublic([4]);
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toMatch(/cmkt_channel_accounts/i);
    expect(sql).toMatch(/cmkt_connectors/i);
    expect(sql).toMatch(/lifecycle_id/i);
    expect(sql).toMatch(/c\.id\s+AS\s+connector_id/i);
    expect(sql).not.toMatch(/access_token|refresh_token/i);
    expect(query).toHaveBeenCalledWith(expect.any(String), [[4]]);
    expect(rows).toEqual([
      expect.objectContaining({
        id: 1,
        channel: 'facebook_page',
        display_name: 'PTT Ads',
        account_ref: '555',
        connector_id: 9,
        status: 'on',
        expires_at: '2026-12-01T00:00:00.000Z',
      }),
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/token|secret/i);
  });

  it('maps missing connector join to connector_id null without secrets', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          id: 1,
          channel: 'facebook_page',
          display_name: 'PTT Ads',
          account_ref: '555',
          connector_id: null,
          status: null,
          expires_at: null,
        },
      ],
    });
    const repo = makePortfolioRepo(query);
    const rows = await repo.listChannelAccountsPublic([4]);
    expect(rows[0]).toEqual(
      expect.objectContaining({ id: 1, connector_id: null }),
    );
    expect(JSON.stringify(rows)).not.toMatch(/access_token|refresh_token/i);
  });
});

describe('clearConnectorSecrets SQL', () => {
  it('nulls tokens, sets off, and returns id/status/expires_at only', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{ id: 9, status: 'off', expires_at: '2026-12-01T00:00:00.000Z' }],
    });
    const repo = makePortfolioRepo(query);
    const out = await repo.clearConnectorSecrets(9);
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toMatch(
      /UPDATE cmkt_connectors\s+SET access_token = NULL, refresh_token = NULL, status = 'off', updated_at = NOW\(\)\s+WHERE id = \$1\s+RETURNING id, status, expires_at/s,
    );
    expect(sql).not.toMatch(/RETURNING[\s\S]*(access_token|refresh_token)/i);
    expect(query).toHaveBeenCalledWith(expect.any(String), [9]);
    expect(out).toEqual({ id: 9, status: 'off', expires_at: '2026-12-01T00:00:00.000Z' });
    expect(JSON.stringify(out)).not.toMatch(/token/i);
  });
});

describe('getConnectorById SQL', () => {
  it('scopes to staff lifecycles and never selects token columns', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{ id: 9, channel_account_id: 1, status: 'on' }],
    });
    const repo = makePortfolioRepo(query);
    const out = await repo.getConnectorById(9, [4]);
    const sql = String(query.mock.calls[0][0]);
    expect(sql).not.toMatch(/access_token|refresh_token/i);
    expect(sql).toMatch(/cmkt_connectors/i);
    expect(sql).toMatch(/cmkt_channel_accounts|lifecycle_id/i);
    expect(query).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining([9, [4]]));
    expect(out).toEqual(expect.objectContaining({ id: 9, channel_account_id: 1, status: 'on' }));
    expect(JSON.stringify(out)).not.toMatch(/token/i);
  });
});
