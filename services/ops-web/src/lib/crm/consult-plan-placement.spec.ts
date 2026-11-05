import { describe, expect, it } from 'vitest';
import { consultOverviewShowsPlanForm } from './consult-plan-placement';

describe('consultOverviewShowsPlanForm', () => {
  it('keeps the plan form off the consult overview', () => {
    expect(consultOverviewShowsPlanForm('consult')).toBe(false);
    expect(consultOverviewShowsPlanForm('proposal')).toBe(true);
  });
});
