import { BadRequestException } from '@nestjs/common';
import { VdAssetSearchService } from './vd-asset-search.service';

describe('VdAssetSearchService', () => {
  const projects = {
    listByLifecycle: jest.fn(),
  };
  const assets = {
    searchByProjectIds: jest.fn(),
  };
  const config = { contentMarketingVideoCinematicEnabled: true };

  function makeSvc() {
    return new VdAssetSearchService(config as never, projects as never, assets as never);
  }

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('rejects invalid lifecycleId', async () => {
    const svc = makeSvc();
    await expect(svc.search({ lifecycleId: 0 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('searches all projects in lifecycle and attaches titles', async () => {
    projects.listByLifecycle.mockResolvedValue([
      { id: 1, title: 'Alpha', lifecycle_id: 4 },
      { id: 2, title: 'Beta', lifecycle_id: 4 },
    ]);
    assets.searchByProjectIds.mockResolvedValue([
      {
        id: 10,
        project_id: 2,
        job_id: null,
        kind: 'keyframe',
        storage_key: '',
        url: '',
        sha256: 'abc',
        width: null,
        height: null,
        duration_ms: null,
        created_at: '2026-09-18T00:00:00.000Z',
      },
    ]);
    const out = await makeSvc().search({ lifecycleId: 4, q: 'abc' });
    expect(assets.searchByProjectIds).toHaveBeenCalledWith({
      projectIds: [1, 2],
      kind: undefined,
      q: 'abc',
      limit: undefined,
    });
    expect(out.items[0].project_title).toBe('Beta');
  });

  it('narrows to project_id when it belongs to lifecycle', async () => {
    projects.listByLifecycle.mockResolvedValue([{ id: 1, title: 'Alpha', lifecycle_id: 4 }]);
    assets.searchByProjectIds.mockResolvedValue([]);
    await makeSvc().search({ lifecycleId: 4, projectId: 1, kind: 'take' });
    expect(assets.searchByProjectIds).toHaveBeenCalledWith({
      projectIds: [1],
      kind: 'take',
      q: undefined,
      limit: undefined,
    });
  });

  it('returns empty items when project_id not in lifecycle', async () => {
    projects.listByLifecycle.mockResolvedValue([{ id: 1, title: 'Alpha', lifecycle_id: 4 }]);
    const out = await makeSvc().search({ lifecycleId: 4, projectId: 99 });
    expect(assets.searchByProjectIds).not.toHaveBeenCalled();
    expect(out.items).toEqual([]);
  });
});
