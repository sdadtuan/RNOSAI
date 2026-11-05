import { VdAssetRepository } from './vd-asset.repository';

function makeRepo(): VdAssetRepository {
  const repo = new VdAssetRepository({
    databaseUrl: 'postgres://127.0.0.1:1/none',
    contentMarketingVideoCinematicEnabled: false,
  } as never);
  jest.spyOn(repo, 'ensurePgReady').mockResolvedValue(false);
  return repo;
}

describe('VdAssetRepository.searchByProjectIds', () => {
  it('returns empty when projectIds empty', async () => {
    const repo = makeRepo();
    await expect(repo.searchByProjectIds({ projectIds: [] })).resolves.toEqual([]);
  });

  it('filters by projectIds, kind, and q on id/sha/storage_key', async () => {
    const repo = makeRepo();
    const a = await repo.insert({
      project_id: 1,
      job_id: null,
      kind: 'keyframe',
      sha256: 'deadbeef01',
      storage_key: 'kf/one',
    });
    await repo.insert({
      project_id: 2,
      job_id: null,
      kind: 'take',
      sha256: 'cafe0000',
      storage_key: 'take/two',
    });
    await repo.insert({
      project_id: 1,
      job_id: null,
      kind: 'master',
      sha256: 'aabbcc',
      storage_key: 'master/x',
    });

    const byProject = await repo.searchByProjectIds({ projectIds: [1] });
    expect(byProject.map((r) => r.kind).sort()).toEqual(['keyframe', 'master']);

    const byKind = await repo.searchByProjectIds({
      projectIds: [1, 2],
      kind: 'take',
    });
    expect(byKind).toHaveLength(1);
    expect(byKind[0].kind).toBe('take');

    const byId = await repo.searchByProjectIds({
      projectIds: [1],
      q: String(a.id),
    });
    expect(byId).toHaveLength(1);
    expect(byId[0].id).toBe(a.id);

    const bySha = await repo.searchByProjectIds({
      projectIds: [1, 2],
      q: 'dead',
    });
    expect(bySha).toHaveLength(1);
    expect(bySha[0].sha256).toBe('deadbeef01');
  });

  it('caps limit at 100 and defaults to 50', async () => {
    const repo = makeRepo();
    for (let i = 0; i < 110; i++) {
      await repo.insert({
        project_id: 9,
        job_id: null,
        kind: 'keyframe',
        storage_key: `k/${i}`,
      });
    }
    const def = await repo.searchByProjectIds({ projectIds: [9] });
    expect(def.length).toBe(50);
    const over = await repo.searchByProjectIds({ projectIds: [9], limit: 500 });
    expect(over.length).toBe(100);
  });
});
