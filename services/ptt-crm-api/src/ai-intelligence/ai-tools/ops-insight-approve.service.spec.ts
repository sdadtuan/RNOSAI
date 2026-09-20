import { ConflictException } from '@nestjs/common';
import { OpsInsightApproveService } from './ops-insight-approve.service';

describe('OpsInsightApproveService', () => {
  const repo = {
    getInsightById: jest.fn(),
    approveAiInsightInternal: jest.fn(),
  };
  const svc = new OpsInsightApproveService(repo as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('dry_run previews approved_internal for AI draft', async () => {
    repo.getInsightById.mockResolvedValue({
      id: 123,
      project_id: 9,
      status: 'draft',
      ai_generated: true,
    });
    const out = await svc.approve({ insight_id: 123, dry_run: true }, 'lead@ptt');
    expect(out.status).toBe('approved_internal');
    expect(out.dry_run).toBe(true);
    expect(repo.approveAiInsightInternal).not.toHaveBeenCalled();
  });

  it('approves AI draft', async () => {
    repo.getInsightById.mockResolvedValue({
      id: 123,
      project_id: 9,
      status: 'draft',
      ai_generated: true,
    });
    repo.approveAiInsightInternal.mockResolvedValue({
      id: 123,
      project_id: 9,
      status: 'approved_internal',
    });
    const out = await svc.approve({ insight_id: 123 }, 'lead@ptt');
    expect(out.ok).toBe(true);
    expect(out.status).toBe('approved_internal');
    expect(repo.approveAiInsightInternal).toHaveBeenCalled();
  });

  it('rejects non-AI insight', async () => {
    repo.getInsightById.mockResolvedValue({
      id: 5,
      project_id: 1,
      status: 'draft',
      ai_generated: false,
    });
    await expect(svc.approve({ insight_id: 5 }, 'lead@ptt')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
