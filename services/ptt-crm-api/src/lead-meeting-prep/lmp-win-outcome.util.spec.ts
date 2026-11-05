import { buildWinOutcomeFromDebrief, winOutcomeHasDebrief } from './lmp-win-outcome.util';

describe('lmp-win-outcome.util', () => {
  it('builds win outcome from debrief', () => {
    const out = buildWinOutcomeFromDebrief({
      leadStatus: 'chot',
      metaJson: {
        deal_value_vnd: 15_000_000,
        lmp_discover: { discover_source: 'am_manual', confirmed_by_am: true },
      },
      debrief: {
        closed_tier: 'TC',
        objection_faced: 'Đắt quá',
        am_feedback: 'ROI script OK',
        sci_helpful: true,
      },
      actorEmail: 'am@test.vn',
      prepStage: 'm3_pre_close',
    });
    expect(out.outcome).toBe('won');
    expect(out.closed_tier).toBe('TC');
    expect(out.deal_value_vnd).toBe(15_000_000);
    expect(out.submitted_by).toBe('am@test.vn');
    expect(out.discover_source).toBe('am_manual');
    expect(out.identity_confirmed_by_am).toBe(true);
  });

  it('maps won status to won outcome', () => {
    const out = buildWinOutcomeFromDebrief({
      leadStatus: 'won',
      metaJson: {},
      debrief: { closed_tier: 'TC', objection_faced: 'Giá', am_feedback: 'OK' },
      actorEmail: 'am@test.vn',
    });
    expect(out.outcome).toBe('won');
  });

  it('detects debrief presence', () => {
    expect(winOutcomeHasDebrief({ submitted_at: 'x', closed_tier: 'CB' })).toBe(true);
    expect(winOutcomeHasDebrief({})).toBe(false);
  });
});
