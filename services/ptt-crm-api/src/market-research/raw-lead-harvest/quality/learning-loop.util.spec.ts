import {
  computeLearningAdjustment,
  learningDeltaFromSignals,
} from './learning-loop.util';

describe('learning-loop.util', () => {
  it('sums dial + feedback deltas', () => {
    expect(
      learningDeltaFromSignals({
        dial_outcome: 'connected',
        feedback_code: null,
      }),
    ).toEqual({ delta: 10, reasons: ['dial:connected'] });

    expect(
      learningDeltaFromSignals({
        dial_outcome: 'wrong_number',
        feedback_code: 'bad_phone',
      }).delta,
    ).toBe(-45);
  });

  it('applies idempotent base restore then new delta', () => {
    const out = computeLearningAdjustment({
      quality_score: 70,
      learning_delta: 10,
      dial_outcome: 'out_of_business',
      feedback_code: null,
      readiness_status: 'READY_TO_PUSH',
      contactable: true,
      phone_norm: '0909479018',
    });
    // base = 70 - 10 = 60; new delta -40 → 20; READY still maps to P2
    expect(out.learning_delta).toBe(-40);
    expect(out.quality_score).toBe(20);
    expect(out.priority_tier).toBe('P2');
    expect(out.changed).toBe(true);
    expect(out.direction).toBe('demoted');
  });

  it('boosts connected ready lead toward P1 when score crosses 50', () => {
    const out = computeLearningAdjustment({
      quality_score: 45,
      learning_delta: 0,
      dial_outcome: 'connected',
      feedback_code: null,
      readiness_status: 'READY_TO_PUSH',
      contactable: true,
      phone_norm: '0909479018',
    });
    expect(out.quality_score).toBe(55);
    expect(out.priority_tier).toBe('P1');
    expect(out.direction).toBe('boosted');
  });

  it('no-ops when no dial/feedback signals', () => {
    const out = computeLearningAdjustment({
      quality_score: 60,
      learning_delta: 0,
      dial_outcome: null,
      feedback_code: null,
      readiness_status: 'READY_TO_PUSH',
      contactable: true,
      phone_norm: '0909479018',
    });
    expect(out.changed).toBe(false);
    expect(out.direction).toBe('unchanged');
    expect(out.quality_score).toBe(60);
  });

  it('clamps score to 0..100', () => {
    const out = computeLearningAdjustment({
      quality_score: 5,
      learning_delta: 0,
      dial_outcome: 'out_of_business',
      feedback_code: 'fake_company',
      readiness_status: 'NEEDS_REVIEW',
      contactable: false,
    });
    expect(out.quality_score).toBe(0);
    expect(out.learning_delta).toBeLessThan(0);
  });
});
