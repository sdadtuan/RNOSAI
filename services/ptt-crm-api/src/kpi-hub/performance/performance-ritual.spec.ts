import {
  assertActualWritable,
  assertRedRitual,
  assertReviewTransition,
  nextCorrection,
} from './performance-ritual';

describe('performance-ritual', () => {
  it('locks verified auto actual (AC-PM-08)', () => {
    expect(() =>
      assertActualWritable({ quality: 'verified', collection_method: 'api', incoming_actual: 1 }),
    ).toThrow(/actual_locked/);
    expect(() =>
      assertActualWritable({ quality: 'pending', collection_method: 'api', incoming_actual: 1 }),
    ).not.toThrow();
    expect(() =>
      assertActualWritable({ quality: 'verified', collection_method: 'manual', incoming_actual: 1 }),
    ).not.toThrow();
  });

  it('red requires blocker and action (AC-PM-03)', () => {
    expect(() => assertRedRitual({ health: 'red', blocker: '', action_title: 'Fix P1' })).toThrow(
      /blocker_required_when_red/,
    );
    expect(() => assertRedRitual({ health: 'red', blocker: '03 P1', action_title: '' })).toThrow(
      /action_required_when_red/,
    );
    expect(() => assertRedRitual({ health: 'red', blocker: '03 P1', action_title: 'Fix P1' })).not.toThrow();
    expect(() => assertRedRitual({ health: 'green', blocker: '', action_title: '' })).not.toThrow();
  });

  it('return requires comment; correction is a new record', () => {
    expect(() => assertReviewTransition('submitted', 'returned', '')).toThrow(/return_comment_required/);
    expect(assertReviewTransition('submitted', 'approved', '')).toBe('approved');
    expect(assertReviewTransition('submitted', 'escalated', 'need head')).toBe('escalated');
    const next = nextCorrection({ id: 'act-1', value: 5.2, quality: 'verified' }, 4.9);
    expect(next).toMatchObject({ value: 4.9, supersedes: 'act-1', quality: 'pending' });
    expect(next.id).not.toBe('act-1');
  });
});
