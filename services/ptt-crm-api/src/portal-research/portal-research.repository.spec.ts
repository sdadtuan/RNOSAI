import { PortalResearchRepository } from './portal-research.repository';

describe('PortalResearchRepository', () => {
  const queryMock = jest.fn();
  const config = { databaseUrl: 'postgresql://test' } as never;

  function repoWithMock(): PortalResearchRepository {
    const repo = new PortalResearchRepository(config);
    (repo as unknown as { pool: { query: typeof queryMock } }).pool = { query: queryMock };
    return repo;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    queryMock.mockReset();
    queryMock.mockResolvedValue({ rows: [] });
  });

  it('listPortalVisibleVersions filters portal_visible and p.client_id without title', async () => {
    const repo = repoWithMock();
    await repo.listPortalVisibleVersions('550e8400-e29b-41d4-a716-446655440000');
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toMatch(/portal_visible = true/);
    expect(sql).toMatch(/p\.client_id = \$1/);
    expect(sql).not.toMatch(/p\.title/);
    expect(sql).not.toMatch(/ADD COLUMN/);
  });

  it('getPortalReportVersion selects client_id without project title', async () => {
    const repo = repoWithMock();
    await repo.getPortalReportVersion(42);
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toMatch(/p\.client_id/);
    expect(sql).toMatch(/WHERE v\.id = \$1/);
    expect(sql).not.toMatch(/p\.title/);
  });
});
