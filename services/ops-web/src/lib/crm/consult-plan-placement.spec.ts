import { describe, expect, it } from 'vitest';
import { showPreliminaryMarketingPlan } from './consult-plan-placement';

describe('showPreliminaryMarketingPlan', () => {
  it('shows the plan only while Tư vấn can still move straight to Báo giá', () => {
    expect(showPreliminaryMarketingPlan({ stage: 'consult', handoffStatus: '', quotePhase: '' })).toBe(true);
    expect(showPreliminaryMarketingPlan({ stage: 'consult' })).toBe(true);
  });

  it('hides the plan after Solution, after the quote starts, and after Tư vấn', () => {
    expect(showPreliminaryMarketingPlan({ stage: 'consult', handoffStatus: 'pending' })).toBe(false);
    expect(showPreliminaryMarketingPlan({ stage: 'consult', handoffStatus: 'with_solution' })).toBe(false);
    expect(showPreliminaryMarketingPlan({ stage: 'consult', handoffStatus: 'released' })).toBe(false);
    expect(showPreliminaryMarketingPlan({ stage: 'consult', quotePhase: 'bao_gia' })).toBe(false);
    expect(showPreliminaryMarketingPlan({ stage: 'consult', quotePhase: 'trien_khai' })).toBe(false);
    expect(showPreliminaryMarketingPlan({ stage: 'proposal', handoffStatus: '' })).toBe(false);
    expect(showPreliminaryMarketingPlan({ stage: 'lead' })).toBe(false);
  });
});
