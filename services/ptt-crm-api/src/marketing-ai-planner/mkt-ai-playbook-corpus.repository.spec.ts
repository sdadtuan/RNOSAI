import { MktAiPlaybookCorpusRepository } from './mkt-ai-playbook-corpus.repository';

describe('MktAiPlaybookCorpusRepository', () => {
  const queryMock = jest.fn();
  const config = { databaseUrl: 'postgresql://test' } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    queryMock.mockReset();
  });

  function repoWithMock(): MktAiPlaybookCorpusRepository {
    const repo = new MktAiPlaybookCorpusRepository(config);
    (repo as unknown as { pool: { query: typeof queryMock } }).pool = { query: queryMock };
    return repo;
  }

  function mockTableProbe(exists: Record<string, boolean>): void {
    queryMock.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (text.includes('information_schema.tables')) {
        const match = text.match(/table_name = \$1/);
        if (match) {
          const table = (queryMock.mock.calls.at(-1)?.[1] as string[] | undefined)?.[0];
          return { rows: [{ ok: Boolean(table && exists[table]) }] };
        }
      }
      return { rows: [] };
    });
  }

  it('returns [] when crm_service_lifecycle table is missing', async () => {
    mockTableProbe({});
    const repo = repoWithMock();

    const rows = await repo.loadCorpusRows('meta-lead-gen');

    expect(rows).toEqual([]);
  });

  it('maps lifecycle SQL row to CorpusLifecycleInput fields', async () => {
    let call = 0;
    queryMock.mockImplementation(async (sql: string, params?: unknown[]) => {
      const text = String(sql);
      if (text.includes('information_schema.tables')) {
        const table = (params?.[0] as string) ?? '';
        const exists = new Set([
          'crm_service_lifecycle',
          'mkt_ai_drafts',
          'mkt_ai_jobs',
          'mkt_ai_plan_versions',
          'crm_leads',
          'crm_customers',
          'crm_svc_tasks',
          'cmkt_content_items',
        ]);
        return { rows: [{ ok: exists.has(table) }] };
      }
      if (text.includes('FROM crm_service_lifecycle lc')) {
        return {
          rows: [
            {
              lifecycle_id: 42,
              service_slug: 'meta-lead-gen',
              stage: 'deliver',
              sqlite_lead_id: 100,
              client_name: 'Acme Corp',
              applied: true,
              quality_score: 82,
              human_edited_after_generate: true,
              is_uat_seed: false,
              closed_loop_win: true,
              has_tier3_artifact: true,
            },
          ],
        };
      }
      if (text.includes('FROM crm_svc_tasks t')) {
        call += 1;
        return {
          rows: [
            { lifecycle_id: 42, title: 'Tuần 1: Setup pixel', week_no: 1 },
          ],
        };
      }
      return { rows: [] };
    });

    const repo = repoWithMock();
    const rows = await repo.loadCorpusRows('meta-lead-gen');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      lifecycleId: 42,
      serviceSlug: 'meta-lead-gen',
      applied: true,
      qualityScore: 82,
      humanEditedAfterGenerate: true,
      isUatSeed: false,
      closedLoopWin: true,
      hasTier3Artifact: true,
      clientName: 'Acme Corp',
      sqliteLeadId: 100,
      stage: 'deliver',
      doneOpsTasks: [
        { lifecycleId: 42, weekNo: 1, taskName: 'Tuần 1: Setup pixel', status: 'done' },
      ],
    });
    expect(call).toBe(1);

    const lifecycleSql = queryMock.mock.calls.find(([sql]) =>
      String(sql).includes('FROM crm_service_lifecycle lc'),
    )?.[0] as string;
    expect(lifecycleSql).toMatch(/lc\.service_slug = \$1/);
    expect(lifecycleSql).toMatch(/apply_to_tmmt/);
    expect(lifecycleSql).toMatch(/closed_loop_win/);
    expect(lifecycleSql).toMatch(/has_tier3_artifact/);
  });

  it('passes excludeLifecycleIds to SQL params', async () => {
    queryMock.mockImplementation(async (sql: string, params?: unknown[]) => {
      const text = String(sql);
      if (text.includes('information_schema.tables')) {
        const table = String(params?.[0] ?? '');
        return {
          rows: [
            {
              ok: table === 'crm_service_lifecycle' || table.startsWith('mkt_ai_'),
            },
          ],
        };
      }
      if (text.includes('FROM crm_service_lifecycle lc')) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    const repo = repoWithMock();
    await repo.loadCorpusRows('meta-lead-gen', [7, 8]);

    const lifecycleCall = queryMock.mock.calls.find(([sql]) =>
      String(sql).includes('FROM crm_service_lifecycle lc'),
    );
    expect(lifecycleCall?.[1]).toEqual(['meta-lead-gen', [7, 8]]);
    expect(String(lifecycleCall?.[0])).toMatch(/lc\.id != ALL\(\$2::bigint\[\]\)/);
  });

  it('returns partial rows when ops tasks query fails', async () => {
    queryMock.mockImplementation(async (sql: string, params?: unknown[]) => {
      const text = String(sql);
      if (text.includes('information_schema.tables')) {
        const table = String(params?.[0] ?? '');
        return {
          rows: [
            {
              ok:
                table === 'crm_service_lifecycle' ||
                table === 'crm_svc_tasks' ||
                table.startsWith('mkt_ai_'),
            },
          ],
        };
      }
      if (text.includes('FROM crm_service_lifecycle lc')) {
        return {
          rows: [
            {
              lifecycle_id: 9,
              service_slug: 'meta-lead-gen',
              stage: 'lead',
              sqlite_lead_id: null,
              client_name: null,
              applied: false,
              quality_score: 0,
              human_edited_after_generate: false,
              is_uat_seed: false,
              closed_loop_win: false,
              has_tier3_artifact: false,
            },
          ],
        };
      }
      if (text.includes('FROM crm_svc_tasks t')) {
        throw new Error('crm_svc_tasks unavailable');
      }
      return { rows: [] };
    });

    const repo = repoWithMock();
    const rows = await repo.loadCorpusRows('meta-lead-gen');

    expect(rows).toHaveLength(1);
    expect(rows[0].lifecycleId).toBe(9);
    expect(rows[0].doneOpsTasks).toBeUndefined();
  });
});
