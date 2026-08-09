import { BadRequestException } from '@nestjs/common';
import { ContentWorkflowService } from './content-workflow.service';

describe('ContentWorkflowService', () => {
  const core = { ensureLifecycleEnabled: jest.fn().mockResolvedValue({}) };
  const repo = {
    getItemById: jest.fn(),
    patchItem: jest.fn(),
    insertItemVersion: jest.fn(),
    insertItemComment: jest.fn(),
    listReviewQueue: jest.fn(),
    getReviewQueueSummary: jest.fn(),
  };

  let service: ContentWorkflowService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContentWorkflowService(core as never, repo as never);
  });

  it('submitReview moves draft to in_review', async () => {
    repo.getItemById.mockResolvedValue({
      id: 1,
      status: 'draft',
      body_json: { markdown: 'Hello world content' },
    });
    repo.patchItem.mockResolvedValue({
      id: 1,
      status: 'in_review',
      body_json: { markdown: 'Hello world content' },
    });

    const out = await service.submitReview(1, 1, 'sp@test.vn');
    expect(out.status).toBe('in_review');
    expect(repo.insertItemVersion).toHaveBeenCalledWith(1, expect.anything(), 'sp@test.vn', 'submit_review');
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
});
