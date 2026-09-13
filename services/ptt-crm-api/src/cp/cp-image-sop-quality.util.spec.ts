import { evaluateQuality } from './cp-image-sop-quality.util';

describe('evaluateQuality', () => {
  it('returns FAIL when a required dimension is below 60', () => {
    const out = evaluateQuality({
      profile: 'brand_kv_v1',
      checks: { technical: 55, brand_fit: 90, creative_fit: 90, delivery: 90 },
    });
    expect(out.decision).toBe('FAIL');
    expect(out.scores_json.technical).toBe(55);
  });

  it('returns ESCALATE when required score is null', () => {
    const out = evaluateQuality({
      profile: 'brand_kv_v1',
      checks: { technical: 90, brand_fit: null, creative_fit: 90, delivery: 90 },
    });
    expect(out.decision).toBe('ESCALATE');
    expect(out.scores_json.brand_fit).toBeNull();
  });

  it('returns PASS when all required scores are strong', () => {
    const out = evaluateQuality({
      profile: 'social_cta_vn_v1',
      checks: {
        technical: 92,
        text_cta_vn: 88,
        brand_fit: 90,
        delivery: 95,
      },
    });
    expect(out.decision).toBe('PASS');
  });
});
