import { BadRequestException } from '@nestjs/common';
import { ApprovalPackageService } from './approval-package.service';
import { ContentWorkflowService } from './content-workflow.service';

const COMPLETE_BRIEF = {
  objective: 'Lead gen',
  funnel: 'consideration',
  persona: 'CMO',
  smm: 'LinkedIn cadence',
  proofs: 'Case study',
  restricted: 'No medical claims',
  disclaimer: 'Results vary',
  cta: 'Book demo',
  kpi: 'MQLs',
};

describe('ContentWorkflowService', () => {
  const core = { ensureLifecycleEnabled: jest.fn().mockResolvedValue({}) };
  const config = { contentMarketingClientGate: true };
  const repo = {
    getItemById: jest.fn(),
    patchItem: jest.fn(),
    insertItemVersion: jest.fn(),
    insertItemComment: jest.fn(),
    listReviewQueue: jest.fn(),
    getReviewQueueSummary: jest.fn(),
    listAssetRights: jest.fn().mockResolvedValue([]),
    insertApprovalPackage: jest.fn(),
    getLatestApprovalPackage: jest.fn(),
    updateApprovalPackageStatus: jest.fn(),
  };

  const production = { initProductionOnApprove: jest.fn().mockResolvedValue(undefined) };

  let service: ContentWorkflowService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo.listAssetRights.mockResolvedValue([]);
    service = new ContentWorkflowService(
      config as never,
      core as never,
      repo as never,
      production as never,
      new ApprovalPackageService(repo as never),
    );
  });

  it('submitReview moves draft to in_review', async () => {
    repo.getItemById.mockResolvedValue({
      id: 1,
      status: 'draft',
      risk_level: 'Normal',
      brief_json: COMPLETE_BRIEF,
      body_json: { markdown: 'Hello world content' },
    });
    repo.patchItem.mockResolvedValue({
      id: 1,
      status: 'in_review',
      body_json: { markdown: 'Hello world content' },
    });

    const out = await service.submitReview(1, 1, 'sp@test.vn');
    expect(out.status).toBe('in_review');
    expect(out.approval_matrix).toEqual({
      steps: ['owner', 'account_director', 'client'],
      gateBlockers: [],
    });
    expect(repo.insertItemVersion).toHaveBeenCalledWith(1, expect.anything(), 'sp@test.vn', 'submit_review');
  });

  it('submitReview attaches legal step when body hits a default claim lexeme', async () => {
    repo.getItemById.mockResolvedValue({
      id: 1,
      status: 'draft',
      risk_level: 'Normal',
      channel: 'facebook',
      brief_json: COMPLETE_BRIEF,
      body_json: { markdown: 'Gói giá rẻ cho mọi nhà' },
    });
    repo.patchItem.mockResolvedValue({
      id: 1,
      status: 'in_review',
      body_json: { markdown: 'Gói giá rẻ cho mọi nhà' },
    });

    const out = await service.submitReview(1, 1, 'sp@test.vn');
    expect(out.approval_matrix).toEqual({
      steps: ['owner', 'legal', 'account_director', 'client'],
      gateBlockers: [],
    });
    expect(out.claim_hits).toEqual(['giá rẻ']);
  });

  it('submitReview inserts a Sent approval package snapshot after gates pass', async () => {
    const rights = [{ id: 2, item_id: 1, asset_ref: 'https://cdn/a.jpg', status: 'Valid' }];
    repo.getItemById.mockResolvedValue({
      id: 1,
      status: 'draft',
      risk_level: 'Normal',
      brief_json: COMPLETE_BRIEF,
      body_json: { markdown: 'Hello world content' },
      media_json: { selected_asset_id: 'a1' },
    });
    repo.patchItem.mockResolvedValue({
      id: 1,
      status: 'in_review',
      body_json: { markdown: 'Hello world content' },
    });
    repo.listAssetRights.mockResolvedValue(rights);
    repo.insertApprovalPackage.mockResolvedValue({ id: 9, status: 'Sent' });

    await service.submitReview(1, 1, 'sp@test.vn');

    expect(repo.insertApprovalPackage).toHaveBeenCalledWith({
      item_id: 1,
      status: 'Sent',
      created_by: 'sp@test.vn',
      snapshot_json: {
        body_json: { markdown: 'Hello world content' },
        brief_json: COMPLETE_BRIEF,
        media: { selected_asset_id: 'a1' },
        rights,
        disclaimer: 'Results vary',
      },
    });
  });

  it('submitReview allows E0 generate-path briefs without 80/95 reject', async () => {
    repo.getItemById.mockResolvedValue({
      id: 1,
      status: 'draft',
      risk_level: 'Normal',
      brief_json: { hook: 'Open', audience: 'CMO', goal: 'Lead gen' },
      body_json: { markdown: 'Hello world content' },
    });
    repo.patchItem.mockResolvedValue({
      id: 1,
      status: 'in_review',
      body_json: { markdown: 'Hello world content' },
    });

    const out = await service.submitReview(1, 1, 'sp@test.vn');
    expect(out.status).toBe('in_review');
    expect(repo.patchItem).toHaveBeenCalled();
  });

  it('submitReview rejects when brief score is below threshold', async () => {
    repo.getItemById.mockResolvedValue({
      id: 1,
      status: 'draft',
      risk_level: 'Normal',
      brief_json: { objective: 'Lead gen' },
      body_json: { markdown: 'Hello world content' },
    });

    await expect(service.submitReview(1, 1, 'sp@test.vn')).rejects.toMatchObject({
      response: { error: 'brief_incomplete', score: 15, threshold: 80 },
    });
    expect(repo.patchItem).not.toHaveBeenCalled();
    expect(repo.insertApprovalPackage).not.toHaveBeenCalled();
  });

  it('submitReview uses 95 threshold for Brand-Sensitive risk', async () => {
    repo.getItemById.mockResolvedValue({
      id: 1,
      status: 'draft',
      risk_level: 'Brand-Sensitive',
      brief_json: {
        ...COMPLETE_BRIEF,
        cta: '',
        kpi: '',
      },
      body_json: { markdown: 'Hello world content' },
    });

    await expect(service.submitReview(1, 1, 'sp@test.vn')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.submitReview(1, 1, 'sp@test.vn')).rejects.toMatchObject({
      response: { error: 'brief_incomplete', score: 85, threshold: 95 },
    });
  });

  it('reject without comment fails', async () => {
    repo.getItemById.mockResolvedValue({ id: 1, status: 'in_review', body_json: { markdown: 'x' } });
    await expect(service.reject(1, 1, {}, 'qa@test.vn')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('approve from in_review', async () => {
    repo.getItemById.mockResolvedValue({ id: 1, status: 'in_review', body_json: { markdown: 'x' } });
    repo.patchItem.mockResolvedValue({ id: 1, status: 'approved_internal' });
    const out = await service.approve(1, 1, 'qa@test.vn');
    expect(out.status).toBe('approved_internal');
  });

  it('submitToClient moves approved_internal to pending_client', async () => {
    repo.getItemById.mockResolvedValue({ id: 1, status: 'approved_internal', body_json: { markdown: 'x' } });
    repo.patchItem.mockResolvedValue({ id: 1, status: 'pending_client', body_json: { markdown: 'x' } });
    const out = await service.submitToClient(1, 1, 'am@test.vn');
    expect(out.status).toBe('pending_client');
  });

  it('clientApprove from pending_client', async () => {
    repo.getItemById.mockResolvedValue({ id: 1, status: 'pending_client', body_json: { markdown: 'x' } });
    repo.patchItem.mockResolvedValue({ id: 1, status: 'client_approved', body_json: { markdown: 'x' } });
    const out = await service.clientApprove(1, 1, 'portal:client@test.vn');
    expect(out.status).toBe('client_approved');
  });
});
