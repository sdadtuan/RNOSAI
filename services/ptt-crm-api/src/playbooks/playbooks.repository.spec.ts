import { PlaybooksRepository } from './playbooks.repository';

type QueryFn = (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;

function repoWithQuery(query: QueryFn): PlaybooksRepository {
  const repo = new PlaybooksRepository({ databaseUrl: 'postgres://x' } as never);
  (repo as unknown as { pool: { query: QueryFn } }).pool = { query };
  return repo;
}

describe('PlaybooksRepository sales_kit isolation', () => {
  it('listAllChunks excludes category=sales_kit even when playbook_id is set', async () => {
    const calls: { sql: string }[] = [];
    const repo = repoWithQuery(async (sql) => {
      calls.push({ sql });
      return { rows: [] };
    });
    await repo.listAllChunks('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(calls[0]?.sql).toMatch(/NOT IN \('sales_kit', 'ceo_os'\)/);
  });

  it('list excludes sales_kit from admin total and rows', async () => {
    const calls: { sql: string }[] = [];
    const repo = repoWithQuery(async (sql) => {
      calls.push({ sql });
      return { rows: [{ n: 0 }] };
    });
    await repo.list({ limit: 20, offset: 0 });
    expect(calls.some((c) => /COUNT/.test(c.sql) && /sales_kit/.test(c.sql))).toBe(true);
    expect(calls.some((c) => /FROM ai_playbooks p/.test(c.sql) && /sales_kit/.test(c.sql))).toBe(
      true,
    );
  });
});
