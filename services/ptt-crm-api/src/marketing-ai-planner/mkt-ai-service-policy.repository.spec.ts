import { MktAiServicePolicyRepository } from './mkt-ai-service-policy.repository';

type QueryFn = (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;

function repoWithQuery(query: QueryFn): MktAiServicePolicyRepository {
  const repo = new MktAiServicePolicyRepository({ databaseUrl: 'postgres://x' } as never);
  (repo as unknown as { pool: { query: QueryFn } }).pool = { query };
  return repo;
}

describe('MktAiServicePolicyRepository', () => {
  it('getPolicy returns rollout and enabled when row exists', async () => {
    const repo = repoWithQuery(async (sql, params) => {
      expect(sql).toMatch(/mkt_ai_service_policy/);
      expect(params).toEqual(['quang-cao-facebook']);
      return { rows: [{ rollout: 'pilot', enabled: true }] };
    });
    await expect(repo.getPolicy('quang-cao-facebook')).resolves.toEqual({
      rollout: 'pilot',
      enabled: true,
    });
  });

  it('getPolicy returns null when row missing', async () => {
    const repo = repoWithQuery(async () => ({ rows: [] }));
    await expect(repo.getPolicy('missing-slug')).resolves.toBeNull();
  });

  it('upsertPolicy inserts rollout and enabled', async () => {
    const repo = repoWithQuery(async (sql, params) => {
      expect(sql).toMatch(/INSERT INTO mkt_ai_service_policy/);
      expect(params).toEqual(['seo-retainer', 'pilot', false, 'admin@test.vn']);
      return { rows: [{ rollout: 'pilot', enabled: false }] };
    });
    await expect(
      repo.upsertPolicy('seo-retainer', { rollout: 'pilot', enabled: false }, 'admin@test.vn'),
    ).resolves.toEqual({ rollout: 'pilot', enabled: false });
  });
});
