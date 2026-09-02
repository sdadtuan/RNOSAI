import { canTransitionIwr } from './iwr-workflow.util';

describe('iwr-workflow.util', () => {
  it('allows the W1 happy path and blocks sent-like jumps', () => {
    expect(canTransitionIwr('draft', 'submitted')).toBe(true);
    expect(canTransitionIwr('submitted', 'changes_requested')).toBe(true);
    expect(canTransitionIwr('changes_requested', 'supplemented')).toBe(true);
    expect(canTransitionIwr('supplemented', 'acknowledged')).toBe(true);
    expect(canTransitionIwr('acknowledged', 'draft')).toBe(false);
    expect(canTransitionIwr('acknowledged', 'submitted')).toBe(false);
    expect(canTransitionIwr('waived', 'submitted')).toBe(false);
  });
});
