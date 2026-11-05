import { ContentOsPortfolioRepository } from './content-os-portfolio.repository';

function insightRow(partial: Record<string, unknown> = {}) {
  return {
    id: 11,
    lifecycle_id: 4,
    pattern: 'p',
    evidence: 'e',
    confidence: 0.8,
    status: 'Draft',
    scope_json: {},
    expires_at: null,
    created_at: '2026-09-01T00:00:00.000Z',
    ...partial,
  };
}

function makeRepo(query: jest.Mock) {
  const repo = new ContentOsPortfolioRepository({ databaseUrl: 'postgres://test' } as never);
  Object.assign(repo, { pool: { query }, pgReady: true });
  return repo;
}

describe('ContentOsPortfolioRepository.listInsights', () => {
  it('does not report a query error as an empty insight list', async () => {
    const boom = Object.assign(new Error('terminating connection due to administrator command'), {
      code: '57P01',
    });
    const query = jest.fn().mockRejectedValue(boom);
    const repo = makeRepo(query);
    await expect(repo.listInsights([4], ['Draft', 'Approved'])).rejects.toBe(boom);
  });
});

describe('ContentOsPortfolioRepository.getInsightById', () => {
  it('returns null when the insight row is missing', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repo = makeRepo(query);
    await expect(repo.getInsightById(404)).resolves.toBeNull();
  });

  it('propagates query errors instead of returning null', async () => {
    const query = jest.fn().mockRejectedValue(new Error('cmkt_insights unavailable'));
    const repo = makeRepo(query);
    await expect(repo.getInsightById(11)).rejects.toThrow('cmkt_insights unavailable');
  });
});

describe('ContentOsPortfolioRepository.updateInsightStatus', () => {
  it('approves only when the current status is Draft', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [insightRow({ status: 'Approved' })] });
    const repo = makeRepo(query);
    const out = await repo.updateInsightStatus(11, 'Approved');
    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(/WHERE id = \$1 AND status = 'Draft'/),
      [11, 'Approved'],
    );
    expect(out.status).toBe('Approved');
  });

  it('throws insight_not_found when the row does not exist', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const repo = makeRepo(query);
    await expect(repo.updateInsightStatus(404, 'Approved')).rejects.toThrow('insight_not_found:404');
  });

  it('throws insight_not_draft when the row exists but is not Draft', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [insightRow({ status: 'Approved' })] });
    const repo = makeRepo(query);
    await expect(repo.updateInsightStatus(11, 'Approved')).rejects.toThrow('insight_not_draft');
  });
});
