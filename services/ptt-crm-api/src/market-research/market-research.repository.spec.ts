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

  it('sumTavilyCredits includes desk_tavily, deep_research, research_triangulate, and research_pulse', async () => {
    queryMock.mockResolvedValue({ rows: [{ n: 3 }] });
    const repo = repoWithMock();

    const n = await repo.sumTavilyCredits(9);

    expect(n).toBe(3);
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toContain('desk_tavily');
    expect(sql).toContain('deep_research');
    expect(sql).toContain('research_triangulate');
    expect(sql).toContain('research_pulse');
    expect(sql).toMatch(
      /job_type IN \('desk_tavily',\s*'deep_research',\s*'research_triangulate',\s*'research_pulse'\)/,
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

  it('findConsultFormDataByClientId joins consult tasks via contract agency_client_id', async () => {
    queryMock.mockResolvedValue({
      rows: [{ form_data: { industry: 'Sữa uống', top_competitors: 'Vinamilk' } }],
    });
    const repo = repoWithMock();

    const form = await repo.findConsultFormDataByClientId('acme');

    expect(form).toEqual({ industry: 'Sữa uống', top_competitors: 'Vinamilk' });
    const sql = String(queryMock.mock.calls[0][0]);
    const params = queryMock.mock.calls[0][1] as unknown[];
    expect(sql).toMatch(/crm_svc_tasks/);
    expect(sql).toMatch(/crm_service_lifecycle/);
    expect(sql).toMatch(/crm_contracts/);
    expect(sql).toMatch(/agency_client_id/);
    expect(sql).toMatch(/t\.stage = 'consult'/);
    expect(params).toEqual(['acme']);
  });

  it('findConsultFormDataByClientId returns null when no consult row', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const repo = repoWithMock();
    expect(await repo.findConsultFormDataByClientId('acme')).toBeNull();
  });

  it('listEmbeddings filters theme_code by code or synonym case-insensitively', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const repo = repoWithMock();

    await repo.listEmbeddings({ theme_code: 'Pricing' });

    const sql = String(queryMock.mock.calls[0][0]);
    const params = queryMock.mock.calls[0][1] as unknown[];
    expect(sql).toMatch(/lower\(t2\.theme_code\) = lower\(\$\d+\)/);
    expect(sql).toMatch(/unnest\(t2\.synonyms\)/);
    expect(sql).toMatch(/theme_synonyms/);
    expect(params).toContain('Pricing');
  });

  it('getOpsAnalytics scopes SQL to allowedClientIds and never selects title', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const repo = repoWithMock();

    await repo.getOpsAnalytics({}, ['beta']);

    expect(queryMock).toHaveBeenCalled();
    for (const [sql, params] of queryMock.mock.calls) {
      const text = String(sql);
      expect(text).not.toMatch(/\btitle\b/);
      expect(text).not.toMatch(/marketing.?plan/i);
      expect(text).toMatch(/p\.client_id = ANY\(\$\d+::text\[\]\)/);
      expect(params).toContainEqual(['beta']);
    }
    const cycleSql = String(queryMock.mock.calls[0][0]);
    expect(cycleSql).toMatch(/EXTRACT\(EPOCH FROM \(p\.updated_at - p\.created_at\)\)\/3600/);
    expect(cycleSql).toMatch(/p\.status IN \('approved','distributed'\)/);
    const verifiedSql = String(queryMock.mock.calls[2][0]);
    expect(verifiedSql).toMatch(/qc_status = 'verified'/);
    expect(verifiedSql).toMatch(/COUNT\(DISTINCT e\.project_id\)/);
    const versionsSql = String(queryMock.mock.calls[4][0]);
    expect(versionsSql).toMatch(/crm_research_report_versions/);
    expect(versionsSql).toMatch(/crm_research_reports/);
    const listSql = String(queryMock.mock.calls[5][0]);
    expect(listSql).toMatch(/verified_ev/);
    expect(listSql).toMatch(/p\.id/);
    expect(listSql).toMatch(/p\.client_id/);
    expect(listSql).toMatch(/p\.status/);
  });

  it('getReportVersion selects embargo_until, expires_at, and portal_visible', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const repo = repoWithMock();

    await repo.getReportVersion(1, 10);

    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toMatch(/embargo_until/);
    expect(sql).toMatch(/expires_at/);
    expect(sql).toMatch(/portal_visible/);
    expect(sql).toMatch(/published_by/);
    expect(sql).toMatch(/published_at/);
    expect(sql).not.toMatch(/ADD COLUMN/);
  });

  it('updateReportVersionPortalVisible stamps published_by and published_at when visible', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const repo = repoWithMock();

    await repo.updateReportVersionPortalVisible(1, 10, true, 'lead@ptt');

    const sql = String(queryMock.mock.calls[0][0]);
    const params = queryMock.mock.calls[0][1] as unknown[];
    expect(sql).toMatch(/published_by/);
    expect(sql).toMatch(/published_at\s*=\s*now\(\)/);
    expect(params).toEqual(expect.arrayContaining([10, 1, true, 'lead@ptt']));
  });

  it('updateReportVersionPortalVisible does not clear audit columns when unpublishing', async () => {
    queryMock.mockResolvedValue({
      rows: [
        {
          id: 10,
          report_id: 1,
          version: 1,
          content_snapshot: {},
          generated_by: 'am@ptt',
          content_hash: 'abc',
          embargo_until: null,
          expires_at: null,
          portal_visible: false,
          published_by: 'lead@ptt',
          published_at: '2026-08-14T10:00:00.000Z',
          created_at: '2026-08-14',
        },
      ],
    });
    const repo = repoWithMock();

    const row = await repo.updateReportVersionPortalVisible(1, 10, false);

    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toMatch(/portal_visible/);
    expect(sql).not.toMatch(/published_by\s*=/);
    expect(sql).not.toMatch(/published_at\s*=/);
    expect(row?.published_by).toBe('lead@ptt');
    expect(row?.published_at).toBeTruthy();
  });

  it('listReembedCandidates binds corpus stale filter and client scope', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const repo = repoWithMock();

    await repo.listReembedCandidates({
      client_id: 'acme',
      target_dims: 256,
      target_model: 'text-embedding-3-small',
      limit: 25,
    });

    const sql = String(queryMock.mock.calls[0][0]);
    const params = queryMock.mock.calls[0][1] as unknown[];
    expect(sql).toMatch(/approved_client_facing/);
    expect(sql).toMatch(/published/);
    expect(sql).toMatch(/embed_dims IS DISTINCT FROM/);
    expect(sql).toMatch(/p\.client_id = \$3/);
    expect(params).toEqual([256, 'text-embedding-3-small', 'acme', 25]);
  });
});
