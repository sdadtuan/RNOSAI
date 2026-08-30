import { SalesKitTurnsRepository } from './sales-kit-turns.repository';

type QueryFn = (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;

function repoWithQuery(query: QueryFn): SalesKitTurnsRepository {
  const repo = new SalesKitTurnsRepository({ databaseUrl: 'postgres://x' } as never);
  (repo as unknown as { pool: { query: QueryFn } }).pool = { query };
  (repo as unknown as { tableReadyCached: boolean }).tableReadyCached = true;
  return repo;
}

describe('SalesKitTurnsRepository', () => {
  it('stores null actor when staffId is 0', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{
        id: 't1',
        session_id: 12,
        actor_staff_id: null,
        intent: 'gap_to_go',
        user_text: '',
        reply_vi: 'Còn 24 điểm',
        stub_mode: true,
        model_name: 'rules',
        citations_json: [],
        apply_json: {},
        rating: null,
        rating_reason: null,
        created_at: '2026-08-30T00:00:00.000Z',
      }],
    });
    const repo = repoWithQuery(query);
    await repo.insert({
      session_id: 12,
      actor_staff_id: 0,
      intent: 'gap_to_go',
      user_text: '',
      reply_vi: 'Còn 24 điểm',
      stub_mode: true,
      model_name: 'rules',
      citations_json: [],
      apply_json: {},
    });
    expect(query.mock.calls[0][1][1]).toBeNull();
  });

  it('returns empty list when table missing', async () => {
    const repo = new SalesKitTurnsRepository({ databaseUrl: 'postgres://x' } as never);
    jest.spyOn(repo, 'tableReady').mockResolvedValue(false);
    await expect(repo.listBySession(1)).resolves.toEqual([]);
  });
});
