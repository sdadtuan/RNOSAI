import { applyQualityGate } from './quality-gate.util';
import type { VerifyResult } from './verify-contact.util';

function v(over: Partial<VerifyResult> = {}): VerifyResult {
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

describe('applyQualityGate', () => {
  it('volume accepts lower score', () => {
    expect(applyQualityGate('volume', 35, v())).toBe('pending');
    expect(applyQualityGate('volume', 20, v())).toBe('auto_rejected');
  });

  it('quality requires contact + score>=50', () => {
    expect(applyQualityGate('quality', 55, v())).toBe('pending');
    expect(applyQualityGate('quality', 45, v())).toBe('auto_rejected');
  });

  it('marketing accepts phone or email at score>=35 (AM marketing)', () => {
    expect(
      applyQualityGate('marketing', 40, v({ phone_ok: true, email_ok: false })),
    ).toBe('pending');
    expect(
      applyQualityGate('marketing', 40, v({ phone_ok: false, email_ok: true, phone_out: null, phone_norm: null })),
    ).toBe('pending');
    expect(
      applyQualityGate('marketing', 40, v({ phone_ok: false, email_ok: false, phone_out: null, phone_norm: null })),
    ).toBe('pending');
    expect(
      applyQualityGate('marketing', 20, v({ phone_ok: false, email_ok: false, phone_out: null, phone_norm: null })),
    ).toBe('auto_rejected');
    expect(applyQualityGate('marketing', 30, v())).toBe('auto_rejected');
  });
});
