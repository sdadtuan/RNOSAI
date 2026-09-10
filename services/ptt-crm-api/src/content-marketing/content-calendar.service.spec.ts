import { ContentCalendarService } from './content-calendar.service';
import type { CmktCalendarSlotRow, CmktItemRow } from './content-marketing.types';

function item(partial: Partial<CmktItemRow> = {}): CmktItemRow {
  return {
    id: 7,
    lifecycle_id: 1,
    idea_id: null,
    parent_item_id: null,
    title: 'Post',
    format: 'social_post',
    channel: 'facebook',
    funnel_goal: 'awareness',
    status: 'approved_internal',
    assignee_sp: null,
    assignee_qa: null,
    brief_json: {},
    body_json: { markdown: 'body' },
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
    created_by: 'sp@test.vn',
    created_at: '2026-09-10T00:00:00.000Z',
    updated_at: '2026-09-10T00:00:00.000Z',
    ...partial,
  };
}

function slot(partial: Partial<CmktCalendarSlotRow> = {}): CmktCalendarSlotRow {
  return {
    id: 1,
    lifecycle_id: 1,
    item_id: 7,
    scheduled_at: '2026-09-11T10:00:00.000Z',
    timezone: 'Asia/Ho_Chi_Minh',
    reminder_sent: false,
    ...partial,
  };
}

describe('ContentCalendarService collision warning', () => {
  const config = { contentMarketingClientGate: false };
  const core = { ensureLifecycleEnabled: jest.fn().mockResolvedValue({}) };
  const repo = {
    getItemById: jest.fn(),
    getIdeaById: jest.fn(),
    listCalendarSlots: jest.fn(),
    upsertCalendarSlot: jest.fn(),
    patchItem: jest.fn(),
    insertItemVersion: jest.fn(),
    deleteCalendarSlot: jest.fn(),
  };

  let service: ContentCalendarService;

  beforeEach(() => {
    jest.clearAllMocks();
    core.ensureLifecycleEnabled.mockResolvedValue({});
    repo.getIdeaById.mockResolvedValue(null);
    repo.insertItemVersion.mockResolvedValue(undefined);
    service = new ContentCalendarService(config as never, core as never, repo as never);
  });

  it('rejects unparseable scheduled_at with 400 invalid_scheduled_at', async () => {
    repo.getItemById.mockResolvedValue(item({ id: 7, status: 'approved_internal' }));

    await expect(service.upsertSlot(1, 7, { scheduled_at: 'not-a-date' }, 'sp@test.vn')).rejects.toMatchObject({
      response: { error: 'invalid_scheduled_at' },
    });
    expect(repo.upsertCalendarSlot).not.toHaveBeenCalled();
    expect(repo.listCalendarSlots).not.toHaveBeenCalled();
  });

  it('returns collision null when no other slot is nearby on the same channel', async () => {
    const current = item({ id: 7, channel: 'facebook' });
    repo.getItemById.mockResolvedValue(current);
    repo.listCalendarSlots.mockResolvedValue([]);
    repo.upsertCalendarSlot.mockResolvedValue(slot({ item_id: 7 }));
    repo.patchItem.mockResolvedValue({ ...current, status: 'scheduled' });

    const out = await service.upsertSlot(1, 7, { scheduled_at: '2026-09-11T10:00:00.000Z' }, 'sp@test.vn');

    expect(out.collision).toBeNull();
    expect(out.slot.item_id).toBe(7);
    expect(out.item.status).toBe('scheduled');
  });

  it('returns a warning collision (not 409) when another same-channel slot is within ±2h', async () => {
    const current = item({ id: 7, channel: 'facebook' });
    const other = item({ id: 12, channel: 'facebook' });
    repo.getItemById.mockImplementation(async (_lifecycleId: number, itemId: number) =>
      itemId === 7 ? current : itemId === 12 ? other : null,
    );
    repo.listCalendarSlots.mockResolvedValue([
      slot({ id: 2, item_id: 12, scheduled_at: '2026-09-11T11:30:00.000Z' }),
    ]);
    repo.upsertCalendarSlot.mockResolvedValue(slot({ item_id: 7 }));
    repo.patchItem.mockResolvedValue({ ...current, status: 'scheduled' });

    const out = await service.upsertSlot(1, 7, { scheduled_at: '2026-09-11T10:00:00.000Z' }, 'sp@test.vn');

    expect(out.collision).toEqual({ item_id: 12, at: '2026-09-11T11:30:00.000Z' });
    expect(repo.upsertCalendarSlot).toHaveBeenCalled();
    expect(repo.patchItem).toHaveBeenCalled();
  });

  it('does not collide with a different channel or a slot more than 2 hours away', async () => {
    const current = item({ id: 7, channel: 'facebook' });
    repo.getItemById.mockImplementation(async (_lifecycleId: number, itemId: number) => {
      if (itemId === 7) return current;
      if (itemId === 8) return item({ id: 8, channel: 'linkedin' });
      if (itemId === 9) return item({ id: 9, channel: 'facebook' });
      return null;
    });
    repo.listCalendarSlots.mockResolvedValue([
      slot({ id: 2, item_id: 8, scheduled_at: '2026-09-11T10:15:00.000Z' }),
      slot({ id: 3, item_id: 9, scheduled_at: '2026-09-11T12:00:01.000Z' }),
    ]);
    repo.upsertCalendarSlot.mockResolvedValue(slot({ item_id: 7 }));
    repo.patchItem.mockResolvedValue({ ...current, status: 'scheduled' });

    const out = await service.upsertSlot(1, 7, { scheduled_at: '2026-09-11T10:00:00.000Z' }, 'sp@test.vn');

    expect(out.collision).toBeNull();
  });

  it('excludes the upserted item itself when scanning nearby slots', async () => {
    const current = item({ id: 7, channel: 'facebook' });
    repo.getItemById.mockResolvedValue(current);
    repo.listCalendarSlots.mockResolvedValue([
      slot({ id: 1, item_id: 7, scheduled_at: '2026-09-11T10:00:00.000Z' }),
    ]);
    repo.upsertCalendarSlot.mockResolvedValue(slot({ item_id: 7 }));
    repo.patchItem.mockResolvedValue({ ...current, status: 'scheduled' });

    const out = await service.upsertSlot(1, 7, { scheduled_at: '2026-09-11T10:00:00.000Z' }, 'sp@test.vn');

    expect(out.collision).toBeNull();
  });

  it('requires the same pillar id only when both items have a pillar via idea', async () => {
    const current = item({ id: 7, channel: 'facebook', idea_id: 21 });
    const samePillar = item({ id: 12, channel: 'facebook', idea_id: 22 });
    const otherPillar = item({ id: 13, channel: 'facebook', idea_id: 23 });
    repo.getItemById.mockImplementation(async (_lifecycleId: number, itemId: number) => {
      if (itemId === 7) return current;
      if (itemId === 12) return samePillar;
      if (itemId === 13) return otherPillar;
      return null;
    });
    repo.getIdeaById.mockImplementation(async (_lifecycleId: number, ideaId: number) => {
      if (ideaId === 21) return { id: 21, pillar_id: 3 };
      if (ideaId === 22) return { id: 22, pillar_id: 3 };
      if (ideaId === 23) return { id: 23, pillar_id: 9 };
      return null;
    });
    repo.listCalendarSlots.mockResolvedValue([
      slot({ id: 3, item_id: 13, scheduled_at: '2026-09-11T10:30:00.000Z' }),
      slot({ id: 2, item_id: 12, scheduled_at: '2026-09-11T11:00:00.000Z' }),
    ]);
    repo.upsertCalendarSlot.mockResolvedValue(slot({ item_id: 7 }));
    repo.patchItem.mockResolvedValue({ ...current, status: 'scheduled' });

    const out = await service.upsertSlot(1, 7, { scheduled_at: '2026-09-11T10:00:00.000Z' }, 'sp@test.vn');

    expect(out.collision).toEqual({ item_id: 12, at: '2026-09-11T11:00:00.000Z' });
  });

  it('matches channel and time only when either item has no pillar id', async () => {
    const current = item({ id: 7, channel: 'facebook', idea_id: 21 });
    const noPillar = item({ id: 14, channel: 'facebook', idea_id: null });
    repo.getItemById.mockImplementation(async (_lifecycleId: number, itemId: number) =>
      itemId === 7 ? current : itemId === 14 ? noPillar : null,
    );
    repo.getIdeaById.mockImplementation(async (_lifecycleId: number, ideaId: number) =>
      ideaId === 21 ? { id: 21, pillar_id: 3 } : null,
    );
    repo.listCalendarSlots.mockResolvedValue([
      slot({ id: 4, item_id: 14, scheduled_at: '2026-09-11T09:00:00.000Z' }),
    ]);
    repo.upsertCalendarSlot.mockResolvedValue(slot({ item_id: 7 }));
    repo.patchItem.mockResolvedValue({ ...current, status: 'scheduled' });

    const out = await service.upsertSlot(1, 7, { scheduled_at: '2026-09-11T10:00:00.000Z' }, 'sp@test.vn');

    expect(out.collision).toEqual({ item_id: 14, at: '2026-09-11T09:00:00.000Z' });
  });

  it('attaches collision onto listed slots for the SEO/Publish notice', async () => {
    const a = item({ id: 7, channel: 'facebook' });
    const b = item({ id: 12, channel: 'facebook' });
    repo.listCalendarSlots.mockResolvedValue([
      slot({ id: 1, item_id: 7, scheduled_at: '2026-09-11T10:00:00.000Z' }),
      slot({ id: 2, item_id: 12, scheduled_at: '2026-09-11T11:00:00.000Z' }),
    ]);
    repo.getItemById.mockImplementation(async (_lifecycleId: number, itemId: number) =>
      itemId === 7 ? a : itemId === 12 ? b : null,
    );

    const out = await service.listCalendar(1, {});

    expect(out.slots[0]?.collision).toEqual({ item_id: 12, at: '2026-09-11T11:00:00.000Z' });
    expect(out.slots[1]?.collision).toEqual({ item_id: 7, at: '2026-09-11T10:00:00.000Z' });
  });
});
