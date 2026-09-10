import { ContentRepurposeService } from './content-repurpose.service';
import type { CmktItemRow } from './content-marketing.types';

function sourceItem(partial: Partial<CmktItemRow> = {}): CmktItemRow {
  return {
    id: 10,
    lifecycle_id: 1,
    idea_id: null,
    parent_item_id: null,
    title: 'Blog master',
    format: 'blog',
    channel: 'website',
    funnel_goal: 'awareness',
    status: 'approved_internal',
    assignee_sp: null,
    assignee_qa: null,
    brief_json: { hook: 'Lead with proof' },
    body_json: { markdown: '# Hello\n\nBody text.' },
    selected_variant_idx: null,
    quality_score_json: {},
    seo_bridge_id: null,
    email_bridge_id: null,
    production_json: {},
    visual_status: 'not_needed',
    media_json: {},
    published_url: null,
    published_at: null,
    due_at: null,
    in_review_at: null,
    created_by: 'test',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    master_id: null,
    ...partial,
  };
}

describe('ContentRepurposeService master_id', () => {
  const config = { contentMarketingAiEnabled: true };
  const core = { ensureLifecycleEnabled: jest.fn().mockResolvedValue({}) };
  const repo = {
    getItemById: jest.fn(),
    createDerivedItem: jest.fn(),
    insertDerivation: jest.fn(),
    createContentJob: jest.fn(),
  };
  const worker = { processJob: jest.fn() };

  let service: ContentRepurposeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContentRepurposeService(config as never, core as never, repo as never, worker as never);
    repo.insertDerivation.mockResolvedValue({ id: 1, source_item_id: 10, derived_item_id: 20 });
    repo.createContentJob.mockResolvedValue({ id: 88, status: 'queued' });
    worker.processJob.mockResolvedValue({ id: 88, status: 'succeeded' });
  });

  it('sets child master_id to the source id when source is a master', async () => {
    const source = sourceItem({ id: 10, master_id: null });
    repo.getItemById.mockImplementation(async (_lifecycleId: number, itemId: number) =>
      itemId === 10 ? source : { id: 20, master_id: 10, parent_item_id: 10 },
    );
    repo.createDerivedItem.mockResolvedValue({ id: 20, parent_item_id: 10, master_id: 10 });

    const out = await service.repurpose(
      1,
      10,
      { targets: [{ channel: 'facebook', format: 'social_post' }] },
      'sp@test.vn',
    );

    expect(repo.createDerivedItem).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        parent_item_id: 10,
        master_id: 10,
      }),
    );
    expect(out.derived_items[0]?.master_id).toBe(10);
  });

  it('roots a child-of-child at the original master', async () => {
    const source = sourceItem({ id: 20, master_id: 10 });
    repo.getItemById.mockResolvedValue(source);
    repo.createDerivedItem.mockResolvedValue({ id: 30, parent_item_id: 20, master_id: 10 });

    await service.repurpose(
      1,
      20,
      { targets: [{ channel: 'facebook', format: 'social_post' }] },
      'sp@test.vn',
    );

    expect(repo.createDerivedItem).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        parent_item_id: 20,
        master_id: 10,
      }),
    );
  });
});
