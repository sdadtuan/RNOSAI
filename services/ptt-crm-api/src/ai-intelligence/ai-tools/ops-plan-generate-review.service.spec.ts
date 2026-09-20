import { ConflictException } from '@nestjs/common';
import { OpsPlanGenerateReviewService } from './ops-plan-generate-review.service';

describe('OpsPlanGenerateReviewService', () => {
  const repo = {
    getPlanStatus: jest.fn(),
    getOfficialPlan: jest.fn(),
    insertPlanReview: jest.fn(),
  };
  const pack = {
    client: { id: 'd437cc78-0757-44ba-aaa3-9ffb941121dd', name: '360 AUTO DETAILING' },
    known: ['Lead #5'],
    assumed: ['contract_value_vnd=45000000; media_vs_fee_split_unspecified'],
    unknown: ['approved_insight'],
    blockers_for_winning_plan: [
      { code: 'tmmt_gate', detail: '0/12' },
      { code: 'no_approved_insight', detail: '' },
      { code: 'geography_missing', detail: '' },
    ],
    presales: {
      lead: { name: '360' },
      bant: { score: '30/30', decision: 'Go' },
      tmmt: {
        lifecycle_id: 5,
        progress: '0/12',
        gate_passed: false,
        audience_bullets: ['ICP detailing'],
        channels: ['TikTok', 'Facebook'],
        core_message: 'Amplify craft',
        geography_resolved: false,
      },
      contract: { id: 1, value_vnd: 45_000_000 },
    },
  };
  const presales = { buildPack: jest.fn(async () => pack) };
  let svc: OpsPlanGenerateReviewService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo.insertPlanReview.mockResolvedValue(25);
    repo.getOfficialPlan.mockResolvedValue({
      strategy_framework_json: {},
      target_market_prof_json: {},
    });
    svc = new OpsPlanGenerateReviewService(repo as never, presales as never);
  });

  it('creates review plan even when WinningPlanGate fails (soft)', async () => {
    const out = await svc.generateReview(
      { lifecycle_id: 5, clone_from_plan_id: 8 },
      'bot',
    );
    expect(out.status).toBe('review');
    expect(out.plan_id).toBe(25);
    expect(out.gate_snapshot.passed).toBe(false);
    expect(out.gate_snapshot.blockers.map((b) => b.code)).toContain('tmmt_gate');
    expect(repo.insertPlanReview).toHaveBeenCalledWith(
      expect.objectContaining({ name: expect.stringContaining('360') }),
    );
  });

  it('409 when patching active plan without supersede', async () => {
    repo.getPlanStatus.mockResolvedValue('active');
    await expect(
      svc.generateReview({ plan_id: 8, lifecycle_id: 5 }, 'bot'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
