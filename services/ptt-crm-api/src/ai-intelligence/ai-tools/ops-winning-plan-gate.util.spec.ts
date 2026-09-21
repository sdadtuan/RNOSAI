import {
  collectWinningPlanSoftWarnings,
  evaluateWinningPlanGate,
  isResearchOrTmmtStyleTask,
  isScaleAdsStyleTask,
  winningPlanGateFailedBody,
} from './ops-winning-plan-gate.util';

describe('ops-winning-plan-gate.util', () => {
  it('fails for fixture-like TMMT 0/12 + no insight + no geo', () => {
    const gate = evaluateWinningPlanGate(
      {
        tmmt_gate_passed: false,
        tmmt_progress: '0/12',
        approved_insight_count: 0,
        geography_resolved: false,
      },
      { lifecycle_id: 5, plan_id: 8 },
    );
    expect(gate.pass).toBe(false);
    expect(gate.blockers.map((b) => b.code)).toEqual([
      'tmmt_gate',
      'no_approved_insight',
      'geography_missing',
    ]);
    expect(gate.links).toContain('/crm/service-delivery/5?tab=tmmt');
    expect(winningPlanGateFailedBody(gate).error).toBe('winning_plan_gate_failed');
  });

  it('passes when TMMT + insight + geography ok', () => {
    const gate = evaluateWinningPlanGate({
      tmmt_gate_passed: true,
      tmmt_progress: '8/12',
      approved_insight_count: 1,
      geography_resolved: true,
    });
    expect(gate.pass).toBe(true);
    expect(gate.winning_plan_ready).toBe(true);
    expect(gate.blockers).toEqual([]);
    expect(gate.ui_copy).toMatch(/6\/12/);
  });

  it('hard-fails when core fields are only assumed_draft (P8)', () => {
    const gate = evaluateWinningPlanGate({
      tmmt_gate_passed: true,
      tmmt_progress: '8/12',
      approved_insight_count: 1,
      geography_resolved: true,
      core_fields: {
        market_context: { status: 'assumed_draft', text: 'Ngành detailing' },
        segmentation_icp: { status: 'assumed_confirmed', text: 'ICP SME' },
        personas_roles: { status: 'validated', text: 'Owner' },
        pains_desired_outcomes: { status: 'assumed_confirmed', text: 'Lead ổn' },
      },
    });
    expect(gate.pass).toBe(false);
    expect(gate.winning_plan_ready).toBe(false);
    expect(gate.blockers.map((b) => b.code)).toContain('core_unconfirmed');
  });

  it('keeps hub map and proposal totals as soft warnings, never hard blockers', () => {
    const warnings = collectWinningPlanSoftWarnings({
      hubGaps: ['no_campaign_map'],
      proposalGaps: ['totals_zero'],
    });
    expect(warnings.map((w) => w.code)).toEqual(['hub_campaign_map', 'proposal_totals_zero']);
    const gate = evaluateWinningPlanGate({
      tmmt_gate_passed: true,
      tmmt_progress: '8/12',
      approved_insight_count: 1,
      geography_resolved: true,
      core_fields: {
        market_context: { status: 'validated', text: 'Ngành' },
        segmentation_icp: { status: 'assumed_confirmed', text: 'ICP' },
        personas_roles: { status: 'assumed_confirmed', text: 'Owner' },
        pains_desired_outcomes: { status: 'assumed_confirmed', text: 'Lead ổn' },
      },
    });
    expect(gate.pass).toBe(true);
    expect(gate.blockers.map((b) => b.code)).not.toEqual(
      expect.arrayContaining(['hub_campaign_map', 'proposal_totals_zero']),
    );
  });

  it('classifies scale-ads vs research tasks', () => {
    expect(isScaleAdsStyleTask('Scale winning ads — Meta')).toBe(true);
    expect(isScaleAdsStyleTask('Launch CPL optimization')).toBe(true);
    expect(isResearchOrTmmtStyleTask('Hoàn thiện TMMT chi tiết')).toBe(true);
    expect(isResearchOrTmmtStyleTask('Approve market research insight')).toBe(true);
    expect(isScaleAdsStyleTask('Hoàn thiện TMMT chi tiết')).toBe(false);
  });
});
