import { ContentMarketingRepository } from '../content-marketing/content-marketing.repository';

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
});
