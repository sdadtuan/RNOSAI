import { SalesKitLibraryRepository } from './sales-kit-library.repository';

type QueryFn = (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;

function repoWithQuery(query: QueryFn): SalesKitLibraryRepository {
  const repo = new SalesKitLibraryRepository({ databaseUrl: 'postgres://x' } as never);
  (repo as unknown as { pool: { query: QueryFn } }).pool = { query };
  return repo;
}

describe('SalesKitLibraryRepository', () => {
  it('activates an existing playbook on session ensurePlaybook', async () => {
    const calls: { sql: string; params?: unknown[] }[] = [];
    const repo = repoWithQuery(async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes('SELECT id::text, status')) {
        return { rows: [{ id: 'pb-1', status: 'draft' }] };
      }
      return { rows: [] };
    });

    const result = await repo.ensurePlaybook({
      slug: 'sk-session-5-12',
      title: 'Sales kit session/5/12',
      tags: ['sales_kit', 'session'],
      status: 'active',
      createdBy: '1',
    });

    expect(result).toEqual({ id: 'pb-1', status: 'active' });
    expect(calls.some((c) => /UPDATE ai_playbooks SET status = 'active'/.test(c.sql))).toBe(true);
  });

  it('does not mark a non-pending file ready on approve', async () => {
    const calls: { sql: string }[] = [];
    const fileRow = {
      id: 'f1',
      playbook_id: 'pb1',
      lead_id: null,
      session_id: null,
      folder_key: 'dich-vu-seo-tong-the/qa',
      original_name: 'qa.xlsx',
      mime: 'application/pdf',
      storage_key: 'k',
      parse_status: 'failed',
      parse_error: 'xlsx_empty',
      uploaded_by: 1,
      created_at: '2026-01-01',
    };
    const repo = repoWithQuery(async (sql) => {
      calls.push({ sql });
      if (sql.includes('FROM sales_kit_files WHERE id')) {
        return { rows: [fileRow] };
      }
      return { rows: [] };
    });

    await repo.approveFile('f1');
    const readyUpdate = calls.find((c) => c.sql.includes("parse_status = 'ready'"));
    expect(readyUpdate?.sql).toMatch(/parse_status = 'pending'/);
  });

  it('listReadyChunks scopes by service/_common/session and selects embedding_json', async () => {
    const calls: { sql: string; params?: unknown[] }[] = [];
    const repo = repoWithQuery(async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes('information_schema')) {
        return { rows: [{ '?column?': 1 }] };
      }
      return { rows: [] };
    });
    await repo.listReadyChunks({ serviceSlug: 'dich-vu-seo-tong-the', leadId: 5, sessionId: 12 });
    const select = calls.find((c) => c.sql.includes('FROM sales_kit_files'));
    expect(select?.sql).toMatch(/embedding_json/);
    expect(select?.sql).toContain("/_common/%' ESCAPE '/'");
    expect(select?.params).toEqual(['dich-vu-seo-tong-the', 5, 12]);
  });
});
