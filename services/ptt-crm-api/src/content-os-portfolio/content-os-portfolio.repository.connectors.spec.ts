import { ContentMarketingRepository } from '../content-marketing/content-marketing.repository';
import { isConnectorEnabled } from './channel-health.util';

function makeMarketingRepo(query: jest.Mock) {
  const repo = new ContentMarketingRepository({ databaseUrl: 'postgres://test' } as never);
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
