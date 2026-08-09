import { ContentMarketingController } from './content-marketing.controller';

describe('ContentMarketingController', () => {
  const contentMarketing = { getContext: jest.fn() };
  const ideas = { listIdeas: jest.fn(), createIdea: jest.fn(), patchIdea: jest.fn(), convertIdea: jest.fn() };
  const items = {
    listItems: jest.fn(),
    getItem: jest.fn(),
    createItem: jest.fn(),
    patchItem: jest.fn(),
    publishItem: jest.fn(),
  };
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
  const workflow = {
    submitReview: jest.fn(),
    approve: jest.fn(),
    reject: jest.fn(),
    listReviewQueue: jest.fn(),
    reviewQueueSummary: jest.fn(),
  };
  const calendar = { listCalendar: jest.fn(), upsertSlot: jest.fn(), deleteSlot: jest.fn() };
  const audit = { listAudit: jest.fn() };
  const repurpose = { repurpose: jest.fn(), listDerivations: jest.fn() };
  const seoBridge = { bridgeSeo: jest.fn(), getSeoBridgeStatus: jest.fn() };
  const emailBridge = { bridgeEmail: jest.fn(), getEmailBridgeStatus: jest.fn() };
  const production = {
    getProduction: jest.fn(),
    patchProduction: jest.fn(),
    markProductionDone: jest.fn(),
    linkCreative: jest.fn(),
    exportDesignBrief: jest.fn(),
    exportScript: jest.fn(),
  };
  const media = {
    startImageJob: jest.fn(),
    startCarouselSlidesJob: jest.fn(),
    startVisualQaJob: jest.fn(),
    selectMediaAsset: jest.fn(),
  };
  const visual = {
    listVisualReviewQueue: jest.fn(),
    submitVisualReview: jest.fn(),
    approveVisual: jest.fn(),
    rejectVisual: jest.fn(),
    escalateHuman: jest.fn(),
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
      workflow as never,
      calendar as never,
      audit as never,
      repurpose as never,
      seoBridge as never,
      emailBridge as never,
      production as never,
      media as never,
      visual as never,
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

  it('POST submit-review delegates to workflow service', async () => {
    workflow.submitReview.mockResolvedValue({ id: 42, status: 'in_review' });
    const req = { staffUser: { email: 'sp@test.vn' } } as never;
    await expect(controller.submitReview(123, 42, req)).resolves.toEqual({ id: 42, status: 'in_review' });
    expect(workflow.submitReview).toHaveBeenCalledWith(123, 42, 'sp@test.vn');
  });
});
