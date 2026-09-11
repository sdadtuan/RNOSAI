import { BadRequestException } from '@nestjs/common';
import { ContentPlanSnapshotService } from './content-plan-snapshot.service';
import { buildBrandContextJson } from './content-plan-snapshot.util';

describe('ContentPlanSnapshotService', () => {
  const core = {
    ensureLifecycleEnabled: jest.fn().mockResolvedValue({ service_slug: 'tiep-thi-noi-dung' }),
  };
  const repo = {
    loadPlannerSource: jest.fn(),
    getActiveUnsealedSnapshot: jest.fn(),
    getActiveSnapshotSummary: jest.fn(),
    listPillars: jest.fn().mockResolvedValue([]),
    upsertActiveSnapshot: jest.fn(),
    replacePillarsForSnapshot: jest.fn(),
    archivePlannerImportedIdeas: jest.fn(),
    listIdeaTitleKeys: jest.fn(),
    createIdeaFromImport: jest.fn(),
    sealActiveSnapshot: jest.fn(),
  };
  const brandContext = {
    buildFromBrief: jest.fn((brief: Record<string, unknown>) => buildBrandContextJson(brief)),
  };

  let service: ContentPlanSnapshotService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContentPlanSnapshotService(core as never, repo as never, brandContext as never);
  });

  it('ingest rejects when no applied plan', async () => {
    repo.loadPlannerSource.mockResolvedValue(null);
    await expect(service.ingestPlanSnapshot(1, {}, 'lead@test.vn')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('ingest creates snapshot and ideas', async () => {
    repo.loadPlannerSource.mockResolvedValue({
      marketing_plan_id: 10,
      brief_json: { brand_name: 'X' },
      content_json: {
        calendar: [{ title: 'Idea 1', type: 'blog', channel: 'website', copy: 'hook' }],
      },
      campaigns_json: [],
      strategy_framework_json: {},
      target_market_prof_json: {},
    });
    repo.listIdeaTitleKeys.mockResolvedValue(new Set());
    repo.upsertActiveSnapshot.mockResolvedValue(99);
    repo.replacePillarsForSnapshot.mockResolvedValue(1);
    repo.createIdeaFromImport.mockResolvedValue({ id: 1 });

    const out = await service.ingestPlanSnapshot(
      1,
      { mode: 'merge', import_calendar: true, import_pillars: true },
      'lead@test.vn',
    );
    expect(out.ok).toBe(true);
    expect(out.snapshot_id).toBe(99);
    expect(out.ideas_created).toBe(1);
    expect(out.pillars_upserted).toBe(1);
  });

  it('ingest persists brief brand_id and locale on snapshot brand context', async () => {
    repo.loadPlannerSource.mockResolvedValue({
      marketing_plan_id: 10,
      brief_json: { brand_name: 'X', brand_id: 'brand-4', locale: 'vi' },
      content_json: { calendar: [] },
      campaigns_json: [],
      strategy_framework_json: {},
      target_market_prof_json: {},
    });
    repo.listIdeaTitleKeys.mockResolvedValue(new Set());
    repo.upsertActiveSnapshot.mockResolvedValue(99);
    repo.replacePillarsForSnapshot.mockResolvedValue(0);

    await service.ingestPlanSnapshot(1, { mode: 'merge', import_calendar: false }, 'lead@test.vn');

    expect(brandContext.buildFromBrief).toHaveBeenCalledWith({
      brand_name: 'X',
      brand_id: 'brand-4',
      locale: 'vi',
    });
    expect(repo.upsertActiveSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        brand_context_json: expect.objectContaining({
          brand_name: 'X',
          brand_id: 'brand-4',
          locale: 'vi',
        }),
      }),
    );
  });
});
