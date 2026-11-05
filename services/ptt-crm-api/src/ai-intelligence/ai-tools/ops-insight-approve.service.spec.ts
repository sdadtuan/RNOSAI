import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { OpsInsightApproveService } from './ops-insight-approve.service';

describe('OpsInsightApproveService P8.3', () => {
  const repo = {
    getInsightById: jest.fn(),
    approveAiInsightInternal: jest.fn(),
    countApprovedInsights: jest.fn(),
    seedPresalesEvidenceAndRubric: jest.fn(),
    patchInsightConfidence: jest.fn(),
    backfillPresalesInsightOrigin: jest.fn(),
  };
  const svc = new OpsInsightApproveService(repo as never);

  beforeEach(() => {
    jest.clearAllMocks();
    repo.countApprovedInsights.mockResolvedValue(1);
  });

  it('dry_run auto-seeds path for ai_generated draft', async () => {
    repo.getInsightById.mockResolvedValue({
      id: 1,
      project_id: 2,
      status: 'draft',
      ai_generated: true,
      statement: '[P7] Presales insight — 360',
      confidence_rationale: 'P7 insight.draft_from_presales — pending human review',
      confidence_json: { origin: 'presales_ai', source_tool: 'insight.draft_from_presales' },
      evidence_ids: [],
    });
    const out = await svc.approve(
      { insight_id: 1, research_id: 2, lifecycle_id: 5, mode: 'presales_auto', dry_run: true },
      'lead@ptt',
    );
    expect(out.ok).toBe(true);
    expect(out.phase).toBe('P8.3');
    expect(out.path).toBe('presales_auto_seed');
    expect(out.dry_run).toBe(true);
    expect(out.winning_insight_ok).toBe(true);
    expect(repo.seedPresalesEvidenceAndRubric).not.toHaveBeenCalled();
  });

  it('approves with Option A seed', async () => {
    repo.getInsightById.mockResolvedValue({
      id: 1,
      project_id: 2,
      status: 'draft',
      ai_generated: true,
      statement: '[P7] Presales',
      confidence_rationale: 'P7 insight.draft_from_presales',
      confidence_json: { origin: 'presales_ai' },
      evidence_ids: [],
    });
    repo.seedPresalesEvidenceAndRubric.mockResolvedValue([101]);
    repo.approveAiInsightInternal.mockResolvedValue({
      id: 1,
      project_id: 2,
      status: 'approved_internal',
    });
    const out = await svc.approve({ insight_id: 1, mode: 'auto' }, 'lead@ptt');
    expect(out.path).toBe('presales_auto_seed');
    expect(out.evidence_ids).toEqual([101]);
    expect(out.rubric_seeded).toBe(true);
    expect(out.approved_count).toBe(1);
    expect(repo.seedPresalesEvidenceAndRubric).toHaveBeenCalled();
    expect(repo.approveAiInsightInternal).toHaveBeenCalled();
  });

  it('idempotent when already approved', async () => {
    repo.getInsightById.mockResolvedValue({
      id: 1,
      project_id: 2,
      status: 'approved_internal',
      ai_generated: true,
      statement: 'x',
      confidence_rationale: null,
      confidence_json: { origin: 'presales_ai' },
      evidence_ids: [9],
    });
    const out = await svc.approve({ insight_id: 1 }, 'lead@ptt');
    expect(out.already_approved).toBe(true);
    expect(out.path).toBe('already_approved');
    expect(repo.approveAiInsightInternal).not.toHaveBeenCalled();
  });

  it('presales_auto rejects non-presales origin', async () => {
    repo.getInsightById.mockResolvedValue({
      id: 9,
      project_id: 2,
      status: 'draft',
      ai_generated: false,
      statement: 'Manual analyst insight',
      confidence_rationale: null,
      confidence_json: {},
      evidence_ids: [],
    });
    await expect(
      svc.approve({ insight_id: 9, mode: 'presales_auto' }, 'lead@ptt'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('strict blocks without evidence even for AI', async () => {
    repo.getInsightById.mockResolvedValue({
      id: 1,
      project_id: 2,
      status: 'draft',
      ai_generated: true,
      statement: '[P7]',
      confidence_rationale: 'P7',
      confidence_json: { origin: 'presales_ai' },
      evidence_ids: [],
    });
    await expect(svc.approve({ insight_id: 1, mode: 'strict' }, 'lead@ptt')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects non-AI manual without evidence', async () => {
    repo.getInsightById.mockResolvedValue({
      id: 5,
      project_id: 1,
      status: 'draft',
      ai_generated: false,
      statement: 'Manual',
      confidence_rationale: null,
      confidence_json: null,
      evidence_ids: [],
    });
    await expect(svc.approve({ insight_id: 5, mode: 'auto' }, 'lead@ptt')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
