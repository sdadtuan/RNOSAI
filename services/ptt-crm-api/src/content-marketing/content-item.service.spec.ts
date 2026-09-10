import { ConflictException } from '@nestjs/common';
import { ApprovalPackageService } from './approval-package.service';
import { ContentItemService } from './content-item.service';

describe('ContentItemService brief lock', () => {
  const config = {};
  const core = { ensureLifecycleEnabled: jest.fn().mockResolvedValue({}) };
  const repo = {
    getItemById: jest.fn(),
    patchItem: jest.fn(),
    insertItemVersion: jest.fn(),
    createItem: jest.fn(),
    nextItemSeq: jest.fn(),
    listItems: jest.fn(),
    getLatestApprovalPackage: jest.fn(),
    updateApprovalPackageStatus: jest.fn(),
  };

  let service: ContentItemService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo.getLatestApprovalPackage.mockResolvedValue(null);
    service = new ContentItemService(
      config as never,
      core as never,
      repo as never,
      new ApprovalPackageService(repo as never),
    );
  });

  it('persists brief_score when patching brief_json', async () => {
    repo.getItemById.mockResolvedValue({
      id: 7,
      status: 'draft',
      brief_json: {},
      body_json: { markdown: '' },
    });
    repo.patchItem.mockResolvedValue({
      id: 7,
      status: 'draft',
      brief_score: 15,
      brief_json: { objective: 'Lead gen' },
    });

    await service.patchItem(1, 7, { brief_json: { objective: 'Lead gen' } }, 'sp@test.vn');

    expect(repo.patchItem).toHaveBeenCalledWith(
      1,
      7,
      expect.objectContaining({
        brief_json: { objective: 'Lead gen' },
        brief_score: 15,
      }),
    );
  });

  it('rejects brief_json patch when locked without force_version', async () => {
    repo.getItemById.mockResolvedValue({
      id: 7,
      status: 'draft',
      brief_locked_at: '2026-09-10T00:00:00.000Z',
      brief_json: { objective: 'Old' },
      body_json: { markdown: '' },
    });

    await expect(
      service.patchItem(1, 7, { brief_json: { objective: 'New' } }, 'sp@test.vn'),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.patchItem(1, 7, { brief_json: { objective: 'New' } }, 'sp@test.vn'),
    ).rejects.toMatchObject({ response: { error: 'brief_locked' } });
    expect(repo.patchItem).not.toHaveBeenCalled();
  });

  it('allows locked brief patch when force_version is true and audits', async () => {
    repo.getItemById.mockResolvedValue({
      id: 7,
      status: 'draft',
      brief_locked_at: '2026-09-10T00:00:00.000Z',
      brief_json: { objective: 'Old' },
      body_json: { markdown: 'body' },
    });
    repo.patchItem.mockResolvedValue({
      id: 7,
      status: 'draft',
      brief_json: { objective: 'New' },
      body_json: { markdown: 'body' },
    });

    await service.patchItem(
      1,
      7,
      { brief_json: { objective: 'New' }, force_version: true },
      'sp@test.vn',
    );

    expect(repo.patchItem).toHaveBeenCalledWith(
      1,
      7,
      expect.objectContaining({ brief_json: { objective: 'New' }, brief_score: 15 }),
    );
    expect(repo.insertItemVersion).toHaveBeenCalledWith(
      7,
      { markdown: 'body' },
      'sp@test.vn',
      'brief_force_version',
    );
  });

  it('lockBrief sets brief_locked_at', async () => {
    repo.getItemById.mockResolvedValue({
      id: 7,
      status: 'draft',
      brief_json: {},
      body_json: { markdown: '' },
    });
    repo.patchItem.mockResolvedValue({
      id: 7,
      brief_locked_at: '2026-09-10T12:00:00.000Z',
    });

    const out = await service.lockBrief(1, 7);
    expect(out.brief_locked_at).toBeTruthy();
    expect(repo.patchItem).toHaveBeenCalledWith(
      1,
      7,
      expect.objectContaining({ brief_locked_at: expect.any(String) }),
    );
  });
});

describe('ContentItemService master / deliverable', () => {
  const config = {};
  const core = { ensureLifecycleEnabled: jest.fn().mockResolvedValue({}) };
  const repo = {
    getItemById: jest.fn(),
    patchItem: jest.fn(),
    insertItemVersion: jest.fn(),
    createItem: jest.fn(),
    nextItemSeq: jest.fn(),
    listItems: jest.fn(),
    getLatestApprovalPackage: jest.fn(),
    updateApprovalPackageStatus: jest.fn(),
  };

  let service: ContentItemService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo.getLatestApprovalPackage.mockResolvedValue(null);
    service = new ContentItemService(
      config as never,
      core as never,
      repo as never,
      new ApprovalPackageService(repo as never),
    );
  });

  it('createItem as_master persists master_id null and a CNT display_code', async () => {
    repo.nextItemSeq.mockResolvedValue(21);
    repo.createItem.mockImplementation(async (_lifecycleId: number, input: Record<string, unknown>) => ({
      id: 55,
      lifecycle_id: 1,
      title: input.title,
      master_id: input.master_id ?? null,
      display_code: input.display_code,
    }));

    const out = await service.createItem(
      1,
      {
        title: '12 social posts',
        channel: 'facebook',
        format: 'social_post',
        as_master: true,
      },
      'am@ptt.vn',
    );

    expect(repo.nextItemSeq).toHaveBeenCalledTimes(1);
    expect(repo.createItem).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        title: '12 social posts',
        master_id: null,
        display_code: expect.stringMatching(/^CNT-\d{8}-021$/),
      }),
    );
    expect(out.master_id).toBeNull();
    expect(out.display_code).toMatch(/^CNT-\d{8}-021$/);
  });

  it('createItem without as_master does not mint a CNT code', async () => {
    repo.createItem.mockResolvedValue({ id: 3, title: 'Draft', master_id: null });

    await service.createItem(
      1,
      { title: 'Draft', channel: 'facebook', format: 'social_post' },
      'am@ptt.vn',
    );

    expect(repo.nextItemSeq).not.toHaveBeenCalled();
    expect(repo.createItem).toHaveBeenCalledWith(
      1,
      expect.not.objectContaining({ display_code: expect.anything() }),
    );
  });

  it('promoteMaster sets master_id null so the item is a standalone deliverable', async () => {
    repo.getItemById.mockResolvedValue({ id: 7, master_id: 3, status: 'draft' });
    repo.patchItem.mockResolvedValue({ id: 7, master_id: null });

    const out = await service.promoteMaster(1, 7);

    expect(out.master_id).toBeNull();
    expect(repo.patchItem).toHaveBeenCalledWith(1, 7, { master_id: null });
  });

  it('listDeliverables returns self and items whose master_id is current', async () => {
    repo.getItemById.mockResolvedValue({ id: 10, master_id: null, title: 'Master' });
    repo.listItems.mockResolvedValue([
      { id: 10, master_id: null, title: 'Master' },
      { id: 11, master_id: 10, title: 'Child A' },
      { id: 12, master_id: 99, title: 'Other family' },
    ]);

    const out = await service.listDeliverables(1, 10);

    expect(out.items.map((row) => row.id)).toEqual([10, 11]);
  });
});

describe('ContentItemService publishItem gate', () => {
  const config = { contentMarketingClientGate: false, contentMarketingMediaEnabled: false };
  const core = { ensureLifecycleEnabled: jest.fn().mockResolvedValue({}) };
  const repo = {
    getItemById: jest.fn(),
    patchItem: jest.fn(),
    insertItemVersion: jest.fn(),
    createItem: jest.fn(),
    nextItemSeq: jest.fn(),
    listItems: jest.fn(),
    listAssetRights: jest.fn(),
    getLatestApprovalPackage: jest.fn(),
    updateApprovalPackageStatus: jest.fn(),
  };

  let service: ContentItemService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo.getLatestApprovalPackage.mockResolvedValue(null);
    service = new ContentItemService(
      config as never,
      core as never,
      repo as never,
      new ApprovalPackageService(repo as never),
    );
  });

  function publishableItem(overrides: Record<string, unknown> = {}) {
    return {
      id: 7,
      status: 'approved_internal',
      format: 'social_post',
      channel: 'facebook',
      brief_json: {
        objective: 'Lead',
        funnel: 'BOFU',
        persona: 'CMO',
        smm: 'LinkedIn',
        proofs: 'Case',
        restricted: 'None',
        disclaimer: 'N/A',
        cta: 'Book',
        kpi: 'SQL',
      },
      brief_score: 100,
      risk_level: 'Normal',
      body_json: { markdown: 'ready' },
      media_json: {
        ai_assets: [
          {
            id: 'a1',
            type: 'image',
            url: 'https://cdn/blocked.jpg',
            ai_generated: true,
            provider: 'x',
            selected: true,
          },
        ],
      },
      production_json: {},
      visual_status: 'not_needed',
      published_url: null,
      ...overrides,
    };
  }

  it('throws publish_gate_blocked when rightsValid is false', async () => {
    repo.getItemById.mockResolvedValue(publishableItem());
    repo.listAssetRights.mockResolvedValue([{ asset_ref: 'https://cdn/blocked.jpg', status: 'Invalid' }]);

    await expect(service.publishItem(1, 7, {}, 'am@ptt.vn')).rejects.toBeInstanceOf(ConflictException);
    await expect(service.publishItem(1, 7, {}, 'am@ptt.vn')).rejects.toMatchObject({
      response: {
        error: 'publish_gate_blocked',
        blockers: expect.arrayContaining([expect.objectContaining({ code: 'rights_invalid' })]),
      },
    });
    expect(repo.patchItem).not.toHaveBeenCalled();
  });

  it('passes matrix gateBlockers as extra context when publish is already blocked', async () => {
    repo.getItemById.mockResolvedValue(
      publishableItem({
        channel: 'meta_ads',
        brief_json: {
          objective: 'Lead',
          funnel: 'BOFU',
          persona: 'CMO',
          smm: 'Ads',
          proofs: 'Case',
          restricted: 'None',
          disclaimer: 'N/A',
          cta: 'Book',
          kpi: 'SQL',
        },
      }),
    );
    repo.listAssetRights.mockResolvedValue([
      { asset_ref: 'https://cdn/blocked.jpg', status: 'Invalid', paid_ok: false },
    ]);

    await expect(service.publishItem(1, 7, {}, 'am@ptt.vn')).rejects.toMatchObject({
      response: {
        error: 'publish_gate_blocked',
        blockers: expect.arrayContaining([expect.objectContaining({ code: 'rights_invalid' })]),
        gateBlockers: ['Paid media rights invalid'],
      },
    });
  });
});

describe('ContentItemService.getItem matrix', () => {
  const config = {};
  const core = { ensureLifecycleEnabled: jest.fn().mockResolvedValue({}) };
  const repo = {
    getItemById: jest.fn(),
    listAssetRights: jest.fn(),
    getLatestApprovalPackage: jest.fn(),
  };

  let service: ContentItemService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo.getLatestApprovalPackage.mockResolvedValue(null);
    repo.listAssetRights.mockResolvedValue([]);
    service = new ContentItemService(
      config as never,
      core as never,
      repo as never,
      new ApprovalPackageService(repo as never),
    );
  });

  it('attaches approval_matrix and claim_hits on GET item', async () => {
    repo.getItemById.mockResolvedValue({
      id: 7,
      lifecycle_id: 1,
      status: 'draft',
      risk_level: 'Normal',
      channel: 'facebook',
      brief_json: { restricted: 'No medical claims' },
      body_json: { markdown: 'Chúng tôi là số 1' },
    });

    const out = await service.getItem(1, 7);
    expect(out.approval_matrix).toEqual({
      steps: ['owner', 'legal', 'account_director', 'client'],
      gateBlockers: [],
    });
    expect(out.claim_hits).toEqual(['số 1']);
  });
});

describe('ContentItemService package lock', () => {
  const config = {};
  const core = { ensureLifecycleEnabled: jest.fn().mockResolvedValue({}) };
  const repo = {
    getItemById: jest.fn(),
    patchItem: jest.fn(),
    insertItemVersion: jest.fn(),
    createItem: jest.fn(),
    nextItemSeq: jest.fn(),
    listItems: jest.fn(),
    getLatestApprovalPackage: jest.fn(),
    updateApprovalPackageStatus: jest.fn(),
    staffExists: jest.fn(),
    listAssetRights: jest.fn(),
  };

  let service: ContentItemService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo.getLatestApprovalPackage.mockResolvedValue(null);
    repo.listAssetRights.mockResolvedValue([]);
    service = new ContentItemService(
      config as never,
      core as never,
      repo as never,
      new ApprovalPackageService(repo as never),
    );
  });

  function draftItem(overrides: Record<string, unknown> = {}) {
    return {
      id: 7,
      status: 'in_review',
      brief_json: { objective: 'Lead' },
      body_json: { markdown: 'old body', variants: ['Hook A'] },
      ...overrides,
    };
  }

  it('rejects body_json patch when latest package is Sent', async () => {
    repo.getItemById.mockResolvedValue(draftItem());
    repo.getLatestApprovalPackage.mockResolvedValue({ id: 11, item_id: 7, status: 'Sent' });

    await expect(
      service.patchItem(1, 7, { body_json: { markdown: 'new body' } }, 'sp@test.vn'),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.patchItem(1, 7, { body_json: { markdown: 'new body' } }, 'sp@test.vn'),
    ).rejects.toMatchObject({ response: { error: 'package_locked' } });
    expect(repo.patchItem).not.toHaveBeenCalled();
  });

  it('rejects apply_variant when latest package is Sent', async () => {
    repo.getItemById.mockResolvedValue(draftItem());
    repo.getLatestApprovalPackage.mockResolvedValue({ id: 11, item_id: 7, status: 'Sent' });

    await expect(
      service.patchItem(1, 7, { apply_variant: true, selected_variant_idx: 0 }, 'sp@test.vn'),
    ).rejects.toMatchObject({ response: { error: 'package_locked' } });
    expect(repo.patchItem).not.toHaveBeenCalled();
  });

  it('allows body patch with force_version, audits package_force_version, and supersedes Sent', async () => {
    repo.getItemById.mockResolvedValue(draftItem());
    repo.getLatestApprovalPackage.mockResolvedValue({ id: 11, item_id: 7, status: 'Sent' });
    repo.patchItem.mockResolvedValue({
      id: 7,
      status: 'in_review',
      body_json: { markdown: 'new body' },
    });
    repo.updateApprovalPackageStatus.mockResolvedValue({ id: 11, status: 'Superseded' });

    await service.patchItem(
      1,
      7,
      { body_json: { markdown: 'new body' }, force_version: true },
      'sp@test.vn',
    );

    expect(repo.patchItem).toHaveBeenCalledWith(
      1,
      7,
      expect.objectContaining({ body_json: { markdown: 'new body' } }),
    );
    expect(repo.insertItemVersion).toHaveBeenCalledWith(
      7,
      { markdown: 'new body' },
      'sp@test.vn',
      'package_force_version',
    );
    expect(repo.updateApprovalPackageStatus).toHaveBeenCalledWith(11, 'Superseded');
  });

  it('allows title-only patch while latest package is Sent', async () => {
    repo.getItemById.mockResolvedValue(draftItem());
    repo.getLatestApprovalPackage.mockResolvedValue({ id: 11, item_id: 7, status: 'Sent' });
    repo.patchItem.mockResolvedValue({ id: 7, title: 'New title' });

    await service.patchItem(1, 7, { title: 'New title' }, 'sp@test.vn');

    expect(repo.patchItem).toHaveBeenCalledWith(1, 7, { title: 'New title' });
    expect(repo.updateApprovalPackageStatus).not.toHaveBeenCalled();
    expect(repo.insertItemVersion).not.toHaveBeenCalled();
  });

  it('allows assignee patch while latest package is Sent', async () => {
    repo.getItemById.mockResolvedValue(draftItem());
    repo.getLatestApprovalPackage.mockResolvedValue({ id: 11, item_id: 7, status: 'Sent' });
    repo.staffExists.mockResolvedValue(true);
    repo.patchItem.mockResolvedValue({ id: 7, assignee_sp: 4 });

    await service.patchItemAssignees(1, 7, { assignee_sp: 4 });

    expect(repo.patchItem).toHaveBeenCalledWith(1, 7, { assignee_sp: 4 });
    expect(repo.updateApprovalPackageStatus).not.toHaveBeenCalled();
  });

  // E1 UAT: after approve, editing a claim requires force_version → new version + Legal step.
  it('force_version claim after Sent writes a version and GET adds legal when lexeme hits', async () => {
    const claimBody = { markdown: 'Chúng tôi là số 1' };
    repo.getItemById.mockResolvedValue(draftItem());
    repo.getLatestApprovalPackage.mockResolvedValue({ id: 11, item_id: 7, status: 'Sent' });

    await expect(
      service.patchItem(1, 7, { body_json: claimBody }, 'sp@test.vn'),
    ).rejects.toMatchObject({ response: { error: 'package_locked' } });
    expect(repo.patchItem).not.toHaveBeenCalled();

    repo.patchItem.mockResolvedValue({
      id: 7,
      status: 'in_review',
      brief_json: { objective: 'Lead' },
      body_json: claimBody,
    });
    repo.updateApprovalPackageStatus.mockResolvedValue({ id: 11, status: 'Superseded' });

    await service.patchItem(
      1,
      7,
      { body_json: claimBody, force_version: true },
      'sp@test.vn',
    );

    expect(repo.insertItemVersion).toHaveBeenCalledWith(
      7,
      claimBody,
      'sp@test.vn',
      'package_force_version',
    );

    repo.getItemById.mockResolvedValue({
      id: 7,
      lifecycle_id: 1,
      status: 'in_review',
      risk_level: 'Normal',
      channel: 'facebook',
      brief_json: { objective: 'Lead' },
      body_json: claimBody,
    });

    const out = await service.getItem(1, 7);
    expect(out.claim_hits).toEqual(['số 1']);
    expect(out.approval_matrix).toEqual({
      steps: ['owner', 'legal', 'account_director', 'client'],
      gateBlockers: [],
    });
  });
});
