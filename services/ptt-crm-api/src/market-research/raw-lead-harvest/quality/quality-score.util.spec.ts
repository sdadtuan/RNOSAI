import { computeQualityScore } from './quality-score.util';
import { applyQualityGate } from './quality-gate.util';
import type { VerifyResult } from './verify-contact.util';

function baseOk(over: Partial<VerifyResult> = {}): VerifyResult {
  return {
    evidence_ok: true,
    phone_ok: true,
    email_ok: false,
    geo_ok: true,
    title_ok: false,
    website_domain_ok: false,
    fetch: 'ok',
    reasons: [],
    phone_norm: '0901234567',
    phone_out: '0901234567',
    email_out: null,
    ...over,
  };
}

describe('quality-score + gate', () => {
  it('scores evidence+phone+geo = 65', () => {
    expect(computeQualityScore(baseOk(), 0)).toBe(65);
  });

  it('quality gate accepts score>=50 with contact', () => {
    const v = baseOk();
    const score = computeQualityScore(v, 1);
    expect(applyQualityGate('quality', score, v)).toBe('pending');
  });

  it('quality gate rejects no contact', () => {
    const v = baseOk({ phone_ok: false, phone_out: null, phone_norm: null });
    expect(applyQualityGate('quality', 40, v)).toBe('auto_rejected');
  });

  it('rejects search url reason', () => {
    const v = baseOk({ reasons: ['brq4_search_url'] });
    expect(applyQualityGate('quality', 80, v)).toBe('auto_rejected');
  });
});
