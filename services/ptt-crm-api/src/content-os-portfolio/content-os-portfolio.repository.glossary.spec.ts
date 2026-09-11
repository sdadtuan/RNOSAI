import { ContentOsPortfolioRepository } from './content-os-portfolio.repository';

function glossaryRow(partial: Record<string, unknown> = {}) {
  return {
    id: 11,
    lifecycle_id: 4,
    brand_id: 'brand-4',
    term: 'đăng ký nhận tư vấn',
    locale: 'vi',
    preferred: '',
    status: 'Draft',
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

describe('ContentOsPortfolioRepository.listGlossary', () => {
  it('returns empty when cmkt_glossary is missing (42P01)', async () => {
    const query = jest.fn().mockRejectedValue(
      Object.assign(new Error('relation "cmkt_glossary" does not exist'), { code: '42P01' }),
    );
    const repo = makeRepo(query);
    await expect(repo.listGlossary([4], ['Draft', 'Approved'])).resolves.toEqual([]);
  });

  it('does not report a query error as an empty glossary list', async () => {
    const boom = Object.assign(new Error('terminating connection due to administrator command'), {
      code: '57P01',
    });
    const query = jest.fn().mockRejectedValue(boom);
    const repo = makeRepo(query);
    await expect(repo.listGlossary([4], ['Draft', 'Approved'])).rejects.toBe(boom);
  });

  it('selects term, locale, and brand_id from cmkt_glossary', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [glossaryRow()] });
    const repo = makeRepo(query);
    const out = await repo.listGlossary([4], ['Draft', 'Approved']);
    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(/FROM cmkt_glossary/i),
      [[4], ['Draft', 'Approved']],
    );
    const sql = String(query.mock.calls[0]?.[0] ?? '');
    expect(sql).toMatch(/brand_id/);
    expect(sql).toMatch(/term/);
    expect(sql).toMatch(/locale/);
    expect(out[0]).toMatchObject({
      id: 11,
      term: 'đăng ký nhận tư vấn',
      locale: 'vi',
      brand_id: 'brand-4',
      status: 'Draft',
    });
  });
});

describe('ContentOsPortfolioRepository.getGlossaryById', () => {
  it('returns null when the glossary row is missing', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repo = makeRepo(query);
    await expect(repo.getGlossaryById(404)).resolves.toBeNull();
  });

  it('propagates query errors instead of returning null', async () => {
    const query = jest.fn().mockRejectedValue(new Error('cmkt_glossary unavailable'));
    const repo = makeRepo(query);
    await expect(repo.getGlossaryById(11)).rejects.toThrow('cmkt_glossary unavailable');
  });
});

describe('ContentOsPortfolioRepository.updateGlossaryStatus', () => {
  it('approves only when the current status is Draft', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [glossaryRow({ status: 'Approved' })] });
    const repo = makeRepo(query);
    const out = await repo.updateGlossaryStatus(11, 'Approved');
    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(/WHERE id = \$1 AND status = 'Draft'/),
      [11, 'Approved'],
    );
    expect(out.status).toBe('Approved');
  });

  it('throws glossary_not_found when the row does not exist', async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    const repo = makeRepo(query);
    await expect(repo.updateGlossaryStatus(404, 'Approved')).rejects.toThrow('glossary_not_found:404');
  });

  it('throws glossary_not_draft when the row exists but is not Draft', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [glossaryRow({ status: 'Approved' })] });
    const repo = makeRepo(query);
    await expect(repo.updateGlossaryStatus(11, 'Approved')).rejects.toThrow('glossary_not_draft');
  });
});
