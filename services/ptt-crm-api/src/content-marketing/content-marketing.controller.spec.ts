import { ContentMarketingController } from './content-marketing.controller';

describe('ContentMarketingController', () => {
  const contentMarketing = { getContext: jest.fn() };
  const ideas = { listIdeas: jest.fn(), createIdea: jest.fn(), patchIdea: jest.fn(), convertIdea: jest.fn() };
  const items = { listItems: jest.fn(), getItem: jest.fn(), createItem: jest.fn(), patchItem: jest.fn() };
  const snapshots = {
    getPlanSnapshot: jest.fn(),
    ingestPlanSnapshot: jest.fn(),
    sealPlanSnapshot: jest.fn(),
  };
  const generate = {
    startDraftJob: jest.fn(),
    startVariantsJob: jest.fn(),
    getJob: jest.fn(),
    cancelJob: jest.fn(),
  };

  let controller: ContentMarketingController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ContentMarketingController(
      contentMarketing as never,
      ideas as never,
      items as never,
      snapshots as never,
      generate as never,
    );
  });

  it('GET context delegates to service', async () => {
    contentMarketing.getContext.mockResolvedValue({ lifecycle_id: 123, ok: true });
    await expect(controller.context(123)).resolves.toEqual({ lifecycle_id: 123, ok: true });
    expect(contentMarketing.getContext).toHaveBeenCalledWith(123);
  });

  it('GET ideas delegates to idea service', async () => {
    ideas.listIdeas.mockResolvedValue({ ideas: [] });
    await expect(controller.listIdeas(123, 'backlog', undefined)).resolves.toEqual({ ideas: [] });
    expect(ideas.listIdeas).toHaveBeenCalledWith(123, { status: 'backlog', pillar_id: undefined });
  });

  it('POST plan-snapshot/ingest delegates to snapshot service', async () => {
    snapshots.ingestPlanSnapshot.mockResolvedValue({ ok: true, ideas_created: 5 });
    const req = { staffUser: { email: 'lead@test.vn' } } as never;
    await expect(
      controller.ingestPlanSnapshot(123, { mode: 'merge' }, req),
    ).resolves.toEqual({ ok: true, ideas_created: 5 });
    expect(snapshots.ingestPlanSnapshot).toHaveBeenCalledWith(
      123,
      { mode: 'merge' },
      'lead@test.vn',
    );
  });

  it('POST items/:id/jobs/draft delegates to generate service', async () => {
    generate.startDraftJob.mockResolvedValue({ id: 9, status: 'succeeded' });
    const req = { staffUser: { email: 'writer@test.vn' } } as never;
    await expect(controller.startDraftJob(123, 42, { tone: 'bold' }, req)).resolves.toEqual({
      id: 9,
      status: 'succeeded',
    });
    expect(generate.startDraftJob).toHaveBeenCalledWith(123, 42, { tone: 'bold' }, 'writer@test.vn');
  });
});
