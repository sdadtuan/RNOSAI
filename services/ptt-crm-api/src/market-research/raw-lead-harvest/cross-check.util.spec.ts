import {
  applyCrossCheckToScore,
  parseCrossCheckResponse,
} from './cross-check.util';

describe('cross-check.util', () => {
  it('parses deny verdict from JSON', () => {
    const p = parseCrossCheckResponse(
      '{"verdict":"deny","confidence":0.9,"reason":"wrong phone"}',
    );
    expect(p.verdict).toBe('deny');
    expect(p.confidence).toBe(0.9);
  });

  it('deny with high confidence → forceReject / auto_rejected path', () => {
    const applied = applyCrossCheckToScore(80, {
      verdict: 'deny',
      confidence: 0.9,
      reason: 'not found',
    });
    expect(applied.forceReject).toBe(true);
    expect(applied.score).toBeLessThan(80);
  });

  it('confirm boosts score by 15', () => {
    const applied = applyCrossCheckToScore(60, {
      verdict: 'confirm',
      confidence: 0.8,
      reason: 'ok',
    });
    expect(applied.score).toBe(75);
    expect(applied.forceReject).toBe(false);
  });

  it('uncertain leaves score', () => {
    const applied = applyCrossCheckToScore(55, {
      verdict: 'uncertain',
      confidence: 0.2,
      reason: 'unknown',
    });
    expect(applied.score).toBe(55);
    expect(applied.forceReject).toBe(false);
  });
});
