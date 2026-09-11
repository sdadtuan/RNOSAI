import { ContentOsPortfolioService } from './content-os-portfolio.service';

function stubs() {
  return {
    workflow: { listReviewQueue: jest.fn() },
    marketingRepo: { listCalendarSlots: jest.fn() },
  };
}

function makeSvc(
  repo: object,
  workflow: object = stubs().workflow,
  marketingRepo: object = stubs().marketingRepo,
  items: object = { createItem: jest.fn() },
) {
  return new ContentOsPortfolioService(repo as never, workflow as never, marketingRepo as never, items as never);
}

describe('ContentOsPortfolioService.getCommandCenter', () => {
  it('returns zeros and empty queue when no lifecycles in scope', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([]), aggregateCommand: jest.fn() };
    const svc = makeSvc(repo);
    const out = await svc.getCommandCenter({ staffId: 1 });
    expect(out.throughput_week).toBe(0);
    expect(out.wip).toBe(0);
    expect(out.risk_queue).toEqual([]);
    expect(out.capacity_pct).toBeNull();
    expect(repo.aggregateCommand).not.toHaveBeenCalled();
  });

  it('returns empty command center when staffId is missing or zero', async () => {
    const repo = { listScopedLifecycleIds: jest.fn(), aggregateCommand: jest.fn() };
    const svc = makeSvc(repo);
    const out = await svc.getCommandCenter({ staffId: 0 });
    expect(out.throughput_week).toBe(0);
    expect(out.wip).toBe(0);
    expect(out.risk_queue).toEqual([]);
    expect(out.capacity_pct).toBeNull();
    expect(repo.listScopedLifecycleIds).not.toHaveBeenCalled();
    expect(repo.aggregateCommand).not.toHaveBeenCalled();
  });

  it('does not invent capacity when repo returns null', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([3]),
      aggregateCommand: jest.fn().mockResolvedValue({
        throughput_week: 4,
        completed_week: 2,
        wip: 2,
        sla_at_risk: 1,
        sla_breached: 0,
        first_pass_pct: null,
        capacity_pct: null,
        blocked: 1,
        risk_queue: [],
      }),
    };
    const svc = makeSvc(repo);
    const out = await svc.getCommandCenter({ staffId: 1 });
    expect(out.capacity_pct).toBeNull();
    expect(out.throughput_week).toBe(4);
  });

  it('filters tiles and queue to ?lifecycle= when that id is in scope', async () => {
    const filtered = {
      throughput_week: 1,
      completed_week: 1,
      wip: 0,
      sla_at_risk: 0,
      sla_breached: 0,
      first_pass_pct: null,
      capacity_pct: null,
      blocked: 0,
      risk_queue: [{ item_id: 21, lifecycle_id: 4 }],
    };
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4, 7]),
      aggregateCommand: jest.fn().mockResolvedValue(filtered),
    };
    const svc = makeSvc(repo);
    const out = await svc.getCommandCenter({ staffId: 1, lifecycleHint: 4 });
    expect(repo.aggregateCommand).toHaveBeenCalledWith([4]);
    expect(out.risk_queue).toEqual([{ item_id: 21, lifecycle_id: 4 }]);
  });

  it('passes through scoped ids when lifecycle hint is out of scope', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4, 7]),
      aggregateCommand: jest.fn().mockResolvedValue({
        throughput_week: 2,
        completed_week: 1,
        wip: 1,
        sla_at_risk: 0,
        sla_breached: 0,
        first_pass_pct: null,
        capacity_pct: null,
        blocked: 0,
        risk_queue: [],
      }),
    };
    const svc = makeSvc(repo);
    await svc.getCommandCenter({ staffId: 1, lifecycleHint: 99 });
    expect(repo.aggregateCommand).toHaveBeenCalledWith([4, 7]);
  });

  it('computes capacity_pct from scoped production effort and assignees', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      aggregateCommand: jest.fn().mockResolvedValue({
        throughput_week: 1,
        completed_week: 0,
        wip: 1,
        sla_at_risk: 0,
        sla_breached: 0,
        first_pass_pct: null,
        capacity_pct: null,
        blocked: 0,
        risk_queue: [],
      }),
      listScopedProductionItems: jest.fn().mockResolvedValue([
        { id: 21, lifecycle_id: 4, title: 'Reel', assignee_sp: 7, production_json: { effort_h: 20 } },
      ]),
    };
    const svc = makeSvc(repo);
    const out = await svc.getCommandCenter({ staffId: 1 });
    expect(repo.listScopedProductionItems).toHaveBeenCalledWith([4]);
    expect(out.capacity_pct).toBe(50);
    expect(out.capacity_band).toBe('ok');
    expect(out.capacity_pct).not.toBe(78);
  });

  it('propagates production query errors instead of treating them as empty capacity', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      aggregateCommand: jest.fn().mockResolvedValue({
        throughput_week: 1,
        completed_week: 0,
        wip: 1,
        sla_at_risk: 0,
        sla_breached: 0,
        first_pass_pct: null,
        capacity_pct: null,
        blocked: 0,
        risk_queue: [],
      }),
      listScopedProductionItems: jest.fn().mockRejectedValue(new Error('connection refused')),
    };
    const svc = makeSvc(repo);
    await expect(svc.getCommandCenter({ staffId: 1 })).rejects.toThrow('connection refused');
  });

  it('keeps capacity_pct null when scoped items lack effort plus assignee', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      aggregateCommand: jest.fn().mockResolvedValue({
        throughput_week: 2,
        completed_week: 1,
        wip: 1,
        sla_at_risk: 0,
        sla_breached: 0,
        first_pass_pct: null,
        capacity_pct: null,
        blocked: 0,
        risk_queue: [],
      }),
      listScopedProductionItems: jest.fn().mockResolvedValue([
        { id: 21, lifecycle_id: 4, title: 'Reel', assignee_sp: null, production_json: { effort_h: 20 } },
      ]),
    };
    const svc = makeSvc(repo);
    const out = await svc.getCommandCenter({ staffId: 1 });
    expect(out.capacity_pct).toBeNull();
    expect(out.capacity_band).toBeNull();
  });

  it('marks risk_queue CRITICAL_PATH_DELAYED when a critical task is blocked', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      aggregateCommand: jest.fn().mockResolvedValue({
        throughput_week: 1,
        completed_week: 0,
        wip: 1,
        sla_at_risk: 0,
        sla_breached: 0,
        first_pass_pct: null,
        capacity_pct: null,
        blocked: 0,
        risk_queue: [
          {
            item_id: 21,
            lifecycle_id: 4,
            content_code: null,
            title: 'Reel',
            client_label: null,
            risk_signal: 'SLA_AT_RISK',
            owner_label: null,
            sla_remaining_h: 2,
            recommended_action: 'Ưu tiên duyệt trước khi quá SLA',
          },
        ],
      }),
      listScopedProductionItems: jest.fn().mockResolvedValue([
        {
          id: 21,
          lifecycle_id: 4,
          title: 'Reel',
          assignee_sp: 7,
          production_json: {
            effort_h: 12,
            tasks: [
              {
                id: 'script',
                title: 'Script',
                assignee_id: 7,
                raci: { r: 'sp', a: 'am' },
                depends_on: [],
                sla_h: 8,
                effort_h: 5,
                status: 'todo',
              },
              {
                id: 'edit',
                title: 'Edit',
                assignee_id: 7,
                raci: { r: 'sp', a: 'am' },
                depends_on: ['script'],
                sla_h: 8,
                effort_h: 8,
                status: 'blocked',
              },
            ],
          },
        },
      ]),
    };
    const svc = makeSvc(repo);
    const out = await svc.getCommandCenter({ staffId: 1 });
    expect(out.risk_queue[0].risk_signal).toBe('CRITICAL_PATH_DELAYED');
  });
});

describe('ContentOsPortfolioService.listApprovals', () => {
  it('returns empty items when no lifecycles in scope', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([]) };
    const workflow = { listReviewQueue: jest.fn() };
    const svc = makeSvc(repo, workflow);
    const out = await svc.listApprovals({ staffId: 1 });
    expect(out).toEqual({ items: [] });
    expect(workflow.listReviewQueue).not.toHaveBeenCalled();
  });

  it('unions review-queue items and skips a throwing lifecycle', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([2, 3]) };
    const workflow = {
      listReviewQueue: jest
        .fn()
        .mockResolvedValueOnce({ items: [{ id: 10 }] })
        .mockRejectedValueOnce(new Error('lifecycle_disabled')),
    };
    const svc = makeSvc(repo, workflow);
    const out = await svc.listApprovals({ staffId: 1 });
    expect(out.items).toEqual([{ id: 10 }]);
    expect(workflow.listReviewQueue).toHaveBeenCalledWith(2, {});
    expect(workflow.listReviewQueue).toHaveBeenCalledWith(3, {});
  });

  it('caps scoped lifecycle ids at 20', async () => {
    const ids = Array.from({ length: 25 }, (_, i) => i + 1);
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue(ids) };
    const workflow = { listReviewQueue: jest.fn().mockResolvedValue({ items: [] }) };
    const svc = makeSvc(repo, workflow);
    await svc.listApprovals({ staffId: 1 });
    expect(workflow.listReviewQueue).toHaveBeenCalledTimes(20);
  });
});

describe('ContentOsPortfolioService.listRequests', () => {
  it('returns empty items when staffId is missing or zero', async () => {
    const repo = { listScopedLifecycleIds: jest.fn(), listRequests: jest.fn() };
    const svc = makeSvc(repo);
    const out = await svc.listRequests({ staffId: 0 });
    expect(out).toEqual({ items: [] });
    expect(repo.listScopedLifecycleIds).not.toHaveBeenCalled();
    expect(repo.listRequests).not.toHaveBeenCalled();
  });

  it('returns empty items when no lifecycles in scope', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([]), listRequests: jest.fn() };
    const svc = makeSvc(repo);
    const out = await svc.listRequests({ staffId: 1 });
    expect(out).toEqual({ items: [] });
    expect(repo.listRequests).not.toHaveBeenCalled();
  });

  it('returns empty items when requests table is missing', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      listRequests: jest.fn().mockRejectedValue(new Error('relation cmkt_content_requests does not exist')),
    };
    const svc = makeSvc(repo);
    const out = await svc.listRequests({ staffId: 1 });
    expect(out).toEqual({ items: [] });
  });

  it('returns scoped request rows without inventing extras', async () => {
    const row = { id: 9, display_code: 'CR-20260910-001', triage_status: 'Submitted' };
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      listRequests: jest.fn().mockResolvedValue([row]),
    };
    const svc = makeSvc(repo);
    const out = await svc.listRequests({ staffId: 1 });
    expect(out).toEqual({ items: [row] });
    expect(repo.listRequests).toHaveBeenCalledWith([4]);
  });

  it('merges unconverted ideas from scoped lifecycles without inventing clients', async () => {
    const row = { id: 9, display_code: 'CR-20260910-001', triage_status: 'Submitted', client_label: 'Acme' };
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      listRequests: jest.fn().mockResolvedValue([row]),
    };
    const marketingRepo = {
      listIdeas: jest.fn().mockResolvedValue([
        {
          id: 3,
          lifecycle_id: 4,
          title: 'Hook idea',
          status: 'backlog',
          target_goal: 'Reach',
          created_by: 'am@ptt.vn',
          created_at: '2026-09-10T00:00:00.000Z',
          updated_at: '2026-09-10T00:00:00.000Z',
        },
        { id: 4, lifecycle_id: 4, title: 'Done', status: 'converted' },
        { id: 5, lifecycle_id: 4, title: 'Old', status: 'archived' },
      ]),
    };
    const svc = makeSvc(repo, undefined, marketingRepo);
    const out = await svc.listRequests({ staffId: 1 });

    expect(out.items).toHaveLength(2);
    expect(out.items[0]).toEqual(row);
    expect(out.items[1]).toEqual(
      expect.objectContaining({
        kind: 'idea',
        source: 'idea',
        idea_id: 3,
        deliverable_ask: 'Hook idea',
        lifecycle_id: 4,
        client_label: '',
        brand_label: '',
        triage_status: 'backlog',
      }),
    );
    expect(out.items.map((item) => item.client_label)).toEqual(['Acme', '']);
    expect(marketingRepo.listIdeas).toHaveBeenCalledWith(4, {});
  });

  it('adds no extra rows when scoped ideas are empty', async () => {
    const row = { id: 9, display_code: 'CR-20260910-001', triage_status: 'Submitted' };
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      listRequests: jest.fn().mockResolvedValue([row]),
    };
    const marketingRepo = { listIdeas: jest.fn().mockResolvedValue([]) };
    const svc = makeSvc(repo, undefined, marketingRepo);
    const out = await svc.listRequests({ staffId: 1 });
    expect(out).toEqual({ items: [row] });
  });

  it('skips a lifecycle when listIdeas throws', async () => {
    const row = { id: 9, display_code: 'CR-20260910-001', triage_status: 'Submitted' };
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4, 7]),
      listRequests: jest.fn().mockResolvedValue([row]),
    };
    const marketingRepo = {
      listIdeas: jest
        .fn()
        .mockRejectedValueOnce(new Error('lifecycle_disabled'))
        .mockResolvedValueOnce([
          { id: 8, lifecycle_id: 7, title: 'Keep', status: 'backlog' },
        ]),
    };
    const svc = makeSvc(repo, undefined, marketingRepo);
    const out = await svc.listRequests({ staffId: 1 });
    expect(out.items).toHaveLength(2);
    expect(out.items[1]).toEqual(
      expect.objectContaining({ kind: 'idea', source: 'idea', idea_id: 8, deliverable_ask: 'Keep' }),
    );
    expect(marketingRepo.listIdeas).toHaveBeenCalledTimes(2);
  });
});

describe('ContentOsPortfolioService.listPublications', () => {
  it('returns empty slots when no lifecycles in scope', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([]) };
    const marketingRepo = { listCalendarSlots: jest.fn() };
    const svc = makeSvc(repo, undefined, marketingRepo);
    const out = await svc.listPublications({ staffId: 1, from: '2026-09-07', to: '2026-09-13' });
    expect(out).toEqual({ slots: [] });
    expect(marketingRepo.listCalendarSlots).not.toHaveBeenCalled();
  });

  it('uses current ISO week (Mon–Sun) when from/to omitted', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([4]) };
    const marketingRepo = { listCalendarSlots: jest.fn().mockResolvedValue([]) };
    const svc = makeSvc(repo, undefined, marketingRepo);
    await svc.listPublications({ staffId: 1 });
    expect(marketingRepo.listCalendarSlots).toHaveBeenCalledTimes(1);
    const range = marketingRepo.listCalendarSlots.mock.calls[0][1] as { from: string; to: string };
    const from = new Date(range.from);
    const to = new Date(range.to);
    expect(from.getUTCDay()).toBe(1);
    expect(to.getUTCDay()).toBe(0);
    expect(to.getTime()).toBeGreaterThan(from.getTime());
  });

  it('attaches Manual channel_health when no connector rows exist', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([4]) };
    const marketingRepo = {
      listCalendarSlots: jest.fn().mockResolvedValue([
        { id: 1, item_id: 21, item: { id: 21, channel: 'facebook' } },
      ]),
      listChannelConnectors: jest.fn().mockResolvedValue([]),
    };
    const svc = makeSvc(repo, undefined, marketingRepo);
    const out = await svc.listPublications({ staffId: 1, from: '2026-09-07', to: '2026-09-13' });
    expect(out.slots[0].channel_health).toEqual({ status: 'Manual' });
    expect(out.channel_health?.find((row) => row.channel === 'facebook')).toEqual({
      channel: 'facebook',
      status: 'Manual',
    });
  });
});

describe('ContentOsPortfolioService.getChannelHealth', () => {
  it('returns Manual for known channels when no connector table/rows exist', async () => {
    const marketingRepo = { listChannelConnectors: jest.fn().mockResolvedValue([]) };
    const svc = makeSvc({ listScopedLifecycleIds: jest.fn() }, undefined, marketingRepo);
    const out = await svc.getChannelHealth({ staffId: 1 });
    expect(out.channels.length).toBeGreaterThan(0);
    expect(out.channels.every((row) => row.status === 'Manual')).toBe(true);
    expect(out.channels.some((row) => row.channel === 'facebook')).toBe(true);
    expect(JSON.stringify(out)).not.toMatch(/expires_at/);
  });

  it('returns Manual when listChannelConnectors is absent', async () => {
    const svc = makeSvc({ listScopedLifecycleIds: jest.fn() }, undefined, {});
    const out = await svc.getChannelHealth({ staffId: 1 });
    expect(out.channels.every((row) => row.status === 'Manual')).toBe(true);
  });

  it('marks TokenExpired only for a real expired connector row', async () => {
    const marketingRepo = {
      listChannelConnectors: jest.fn().mockResolvedValue([
        { channel: 'facebook', expires_at: '2020-01-01T00:00:00.000Z' },
      ]),
    };
    const svc = makeSvc({ listScopedLifecycleIds: jest.fn() }, undefined, marketingRepo);
    const out = await svc.getChannelHealth({ staffId: 1 });
    expect(out.channels.find((row) => row.channel === 'facebook')).toEqual(
      expect.objectContaining({ status: 'TokenExpired' }),
    );
    expect(out.channels.find((row) => row.channel === 'linkedin')).toEqual(
      expect.objectContaining({ status: 'Manual' }),
    );
  });
});

describe('ContentOsPortfolioService.batchApprove', () => {
  const inReview = { id: 21, lifecycle_id: 4, status: 'in_review', created_by: 'sp@ptt.vn' };
  const inReview22 = { id: 22, lifecycle_id: 4, status: 'in_review', created_by: 'sp@ptt.vn' };

  afterEach(() => {
    delete process.env.CMKT_SOD_ENABLED;
  });

  it('rejects empty and oversized batches with 400', async () => {
    const svc = makeSvc({ listScopedLifecycleIds: jest.fn().mockResolvedValue([4]) });
    await expect(svc.batchApprove({ staffId: 1, actor: 'am@ptt.vn', item_ids: [] })).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      svc.batchApprove({
        staffId: 1,
        actor: 'am@ptt.vn',
        item_ids: Array.from({ length: 21 }, (_, i) => i + 1),
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects mixed in-scope statuses with 409 mixed_step', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([4]) };
    const marketingRepo = {
      findItemById: jest
        .fn()
        .mockResolvedValueOnce(inReview)
        .mockResolvedValueOnce({ ...inReview22, status: 'draft' }),
    };
    const workflow = { approve: jest.fn() };
    const svc = makeSvc(repo, workflow, marketingRepo);
    await expect(
      svc.batchApprove({ staffId: 1, actor: 'am@ptt.vn', item_ids: [21, 22] }),
    ).rejects.toMatchObject({ status: 409 });
    expect(workflow.approve).not.toHaveBeenCalled();
  });

  it('approves in-scope items and records per-item failures without blocking the rest', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([4]) };
    const marketingRepo = {
      findItemById: jest.fn().mockImplementation(async (id: number) => {
        if (id === 21) return inReview;
        if (id === 22) return inReview22;
        if (id === 23) return { id: 23, lifecycle_id: 9, status: 'in_review', created_by: 'sp@ptt.vn' };
        return null;
      }),
    };
    const workflow = {
      approve: jest
        .fn()
        .mockResolvedValueOnce({ id: 21, status: 'approved_internal' })
        .mockRejectedValueOnce(Object.assign(new Error('invalid_transition'), { getResponse: () => ({ error: 'invalid_transition' }) })),
    };
    const svc = makeSvc(repo, workflow, marketingRepo);
    const out = await svc.batchApprove({ staffId: 1, actor: 'am@ptt.vn', item_ids: [21, 22, 23, 99] });
    expect(out.ok).toEqual([21]);
    expect(out.failed).toEqual(
      expect.arrayContaining([
        { id: 23, error: 'lifecycle_out_of_scope' },
        { id: 99, error: 'item_not_found' },
        expect.objectContaining({ id: 22 }),
      ]),
    );
    expect(workflow.approve).toHaveBeenCalledWith(4, 21, 'am@ptt.vn');
    expect(workflow.approve).toHaveBeenCalledWith(4, 22, 'am@ptt.vn');
  });

  it('blocks the creator from final-approve only when SoD is on', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([4]) };
    const marketingRepo = {
      findItemById: jest.fn().mockResolvedValue({ ...inReview, created_by: 'am@ptt.vn' }),
      listItemVersions: jest.fn().mockResolvedValue([]),
      getLatestApprovalPackage: jest.fn().mockResolvedValue({ created_by: 'sp@ptt.vn' }),
    };
    const workflow = { approve: jest.fn().mockResolvedValue({ id: 21, status: 'approved_internal' }) };
    const svc = makeSvc(repo, workflow, marketingRepo);

    const off = await svc.batchApprove({ staffId: 1, actor: 'am@ptt.vn', item_ids: [21] });
    expect(off.ok).toEqual([21]);
    expect(workflow.approve).toHaveBeenCalledTimes(1);

    process.env.CMKT_SOD_ENABLED = '1';
    const on = await svc.batchApprove({ staffId: 1, actor: 'am@ptt.vn', item_ids: [21] });
    expect(on.ok).toEqual([]);
    expect(on.failed).toEqual([{ id: 21, error: 'sod_creator_cannot_final_approve' }]);
    expect(workflow.approve).toHaveBeenCalledTimes(1);
  });

  it('does not let an expired delegate approve', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([4]) };
    const marketingRepo = {
      findItemById: jest.fn().mockResolvedValue(inReview),
      listItemVersions: jest.fn().mockResolvedValue([]),
      getLatestApprovalPackage: jest.fn().mockResolvedValue({
        created_by: 'sp@ptt.vn',
        delegate_until: '2020-01-01T00:00:00.000Z',
        snapshot_json: { delegate_until: '2020-01-01T00:00:00.000Z', delegate_to: 'qa@ptt.vn' },
      }),
    };
    const workflow = { approve: jest.fn() };
    const svc = makeSvc(repo, workflow, marketingRepo);
    const out = await svc.batchApprove({ staffId: 1, actor: 'qa@ptt.vn', item_ids: [21] });
    expect(out.failed).toEqual([{ id: 21, error: 'delegate_expired' }]);
    expect(workflow.approve).not.toHaveBeenCalled();
  });
});

describe('ContentOsPortfolioService.delegateApproval', () => {
  it('persists delegate_until on the package when the item is in staff scope', async () => {
    const until = '2026-09-12T00:00:00.000Z';
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([4]) };
    const marketingRepo = {
      getApprovalPackageById: jest.fn().mockResolvedValue({ id: 9, item_id: 21, created_by: 'am@ptt.vn' }),
      findItemById: jest.fn().mockResolvedValue({ id: 21, lifecycle_id: 4 }),
      updateApprovalPackageDelegate: jest.fn().mockResolvedValue({
        id: 9,
        item_id: 21,
        delegate_until: until,
        snapshot_json: { delegate_until: until, delegate_to: 'qa@ptt.vn' },
      }),
    };
    const svc = makeSvc(repo, undefined, marketingRepo);
    const out = await svc.delegateApproval({
      staffId: 1,
      actor: 'am@ptt.vn',
      packageId: 9,
      delegate_until: until,
      delegate_to: 'qa@ptt.vn',
    });
    expect(marketingRepo.updateApprovalPackageDelegate).toHaveBeenCalledWith(9, {
      delegate_until: until,
      delegate_to: 'qa@ptt.vn',
    });
    expect(out.delegate_until).toBe(until);
    expect(out.delegate_expired).toBe(false);
  });

  it('404 when the package is missing', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([4]) };
    const marketingRepo = { getApprovalPackageById: jest.fn().mockResolvedValue(null) };
    const svc = makeSvc(repo, undefined, marketingRepo);
    await expect(
      svc.delegateApproval({
        staffId: 1,
        actor: 'am@ptt.vn',
        packageId: 9,
        delegate_until: '2026-09-12T00:00:00.000Z',
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('ContentOsPortfolioService.getPortfolioItem', () => {
  const item = { id: 21, lifecycle_id: 4, title: 'Master story', status: 'draft' };

  it('404 when staff has no scoped lifecycles', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([]) };
    const marketingRepo = { findItemById: jest.fn() };
    const items = { getItem: jest.fn() };
    const svc = makeSvc(repo, undefined, marketingRepo, items);
    await expect(svc.getPortfolioItem({ staffId: 1, itemId: 21 })).rejects.toMatchObject({ status: 404 });
    expect(marketingRepo.findItemById).not.toHaveBeenCalled();
    expect(items.getItem).not.toHaveBeenCalled();
  });

  it('404 when item is outside staff-scoped lifecycles', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([4]) };
    const marketingRepo = { findItemById: jest.fn().mockResolvedValue({ ...item, lifecycle_id: 9 }) };
    const svc = makeSvc(repo, undefined, marketingRepo);
    await expect(svc.getPortfolioItem({ staffId: 1, itemId: 21 })).rejects.toMatchObject({ status: 404 });
  });

  it('returns the item when it belongs to a scoped lifecycle', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([4, 7]) };
    const marketingRepo = { findItemById: jest.fn().mockResolvedValue(item) };
    const items = { getItem: jest.fn().mockResolvedValue(item) };
    const svc = makeSvc(repo, undefined, marketingRepo, items);
    await expect(svc.getPortfolioItem({ staffId: 1, itemId: 21 })).resolves.toEqual(item);
    expect(items.getItem).toHaveBeenCalledWith(4, 21);
  });

  it('attaches critical_path_task_ids from production tasks', async () => {
    const withTasks = {
      ...item,
      production_json: {
        tasks: [
          {
            id: 'a',
            title: 'Write',
            assignee_id: 1,
            raci: { r: 'sp', a: 'am' },
            depends_on: [],
            sla_h: 8,
            effort_h: 5,
            status: 'todo',
          },
          {
            id: 'b',
            title: 'Design',
            assignee_id: 2,
            raci: { r: 'sp', a: 'am' },
            depends_on: ['a'],
            sla_h: 8,
            effort_h: 10,
            status: 'todo',
          },
          {
            id: 'c',
            title: 'Side',
            assignee_id: 3,
            raci: { r: 'sp', a: 'am' },
            depends_on: ['a'],
            sla_h: 8,
            effort_h: 2,
            status: 'todo',
          },
        ],
      },
    };
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([4]) };
    const marketingRepo = { findItemById: jest.fn().mockResolvedValue(withTasks) };
    const items = { getItem: jest.fn().mockResolvedValue(withTasks) };
    const svc = makeSvc(repo, undefined, marketingRepo, items);
    const out = await svc.getPortfolioItem({ staffId: 1, itemId: 21 });
    expect(out.critical_path_task_ids).toEqual(['a', 'b']);
  });

  it('uses lifecycle hint first when the hint is in scope', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([4, 7]) };
    const items = { getItem: jest.fn().mockResolvedValue(item) };
    const marketingRepo = { findItemById: jest.fn() };
    const svc = makeSvc(repo, undefined, marketingRepo, items);
    await expect(svc.getPortfolioItem({ staffId: 1, itemId: 21, lifecycleHint: 4 })).resolves.toEqual(item);
    expect(items.getItem).toHaveBeenCalledWith(4, 21);
    expect(marketingRepo.findItemById).not.toHaveBeenCalled();
  });

  it('falls back to scoped scan when hint misses', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([4, 7]) };
    const found = {
      ...item,
      lifecycle_id: 7,
      approval_matrix: { steps: ['owner', 'account_director', 'client'], gateBlockers: [] },
    };
    const items = {
      getItem: jest
        .fn()
        .mockRejectedValueOnce(Object.assign(new Error('not found'), { status: 404 }))
        .mockResolvedValueOnce(found),
    };
    const marketingRepo = { findItemById: jest.fn().mockResolvedValue({ ...item, lifecycle_id: 7 }) };
    const svc = makeSvc(repo, undefined, marketingRepo, items);
    await expect(svc.getPortfolioItem({ staffId: 1, itemId: 21, lifecycleHint: 4 })).resolves.toEqual(found);
    expect(items.getItem).toHaveBeenNthCalledWith(2, 7, 21);
  });
});

