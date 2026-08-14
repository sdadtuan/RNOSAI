import { MarketResearchRepository } from './market-research.repository';

describe('MarketResearchRepository', () => {
  const queryMock = jest.fn();
  const config = { databaseUrl: 'postgresql://test' } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    queryMock.mockReset();
  });

  function repoWithMock(): MarketResearchRepository {
    const repo = new MarketResearchRepository(config);
    (repo as unknown as { pool: { query: typeof queryMock } }).pool = { query: queryMock };
    return repo;
  }

  it('sumTavilyCredits includes desk_tavily, deep_research, and research_triangulate', async () => {
    queryMock.mockResolvedValue({ rows: [{ n: 3 }] });
    const repo = repoWithMock();

    const n = await repo.sumTavilyCredits(9);

    expect(n).toBe(3);
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toContain('desk_tavily');
    expect(sql).toContain('deep_research');
    expect(sql).toContain('research_triangulate');
    expect(sql).toMatch(
      /job_type IN \('desk_tavily',\s*'deep_research',\s*'research_triangulate'\)/,
    );
  });

  it('listProjects filters by lifecycle_id', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const repo = repoWithMock();

    await repo.listProjects({ lifecycle_id: 12 });

    const sql = String(queryMock.mock.calls[0][0]);
    const params = queryMock.mock.calls[0][1] as unknown[];
    expect(sql).toMatch(/p\.lifecycle_id = \$1/);
    expect(params).toContain(12);
  });
});
