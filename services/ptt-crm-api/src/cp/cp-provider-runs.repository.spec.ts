import type { CpAiOpsProvider } from './cp-ai-ops.types';
import { insertProviderRun } from './cp-provider-runs.repository';

describe('insertProviderRun', () => {
  type QueryFn = (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;

  it('inserts a weavy run without job_id and returns { id }', async () => {
    const id = '19d722af-0000-4000-8000-000000000021';
    const query: jest.MockedFunction<QueryFn> = jest.fn(
      async (_sql: string, _params?: unknown[]) => ({
        rows: [{ id }],
        rowCount: 1,
      }),
    );

    const result = await insertProviderRun(
      { provider: 'weavy', mode: 'manual' },
      { query },
    );

    expect(result).toEqual({ id });
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO crm_cp_provider_runs/i);
    expect(params?.[0]).toBeNull();
    expect(params).toContain('weavy');
  });

  it('rejects provider=openai', async () => {
    const query: jest.MockedFunction<QueryFn> = jest.fn(
      async (_sql: string, _params?: unknown[]) => ({ rows: [], rowCount: 0 }),
    );

    await expect(
      insertProviderRun(
        { provider: 'openai' as CpAiOpsProvider, mode: 'manual' },
        { query },
      ),
    ).rejects.toMatchObject({
      status: 400,
      response: { error: 'invalid_provider' },
    });
    expect(query).not.toHaveBeenCalled();
  });
});
