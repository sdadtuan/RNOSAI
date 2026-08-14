import { assertSimilarwebTier, sanitizeCompetitorFact } from './competitor-snapshot.util';

describe('sanitizeCompetitorFact', () => {
  it('drops fact key secret_sauce', () => {
    const out = sanitizeCompetitorFact({
      price: '12000',
      secret_sauce: 'never persist',
    });
    expect(out).toEqual({ price: '12000' });
    expect(out).not.toHaveProperty('secret_sauce');
  });
});

describe('assertSimilarwebTier', () => {
  it('throws reliability_capped for publisher Similarweb with tier high', () => {
    expect(() =>
      assertSimilarwebTier({
        publisher: 'Similarweb',
        reliability_tier: 'high',
        limitation_note: 'Paid panel estimate',
      }),
    ).toThrow('reliability_capped');
    try {
      assertSimilarwebTier({
        publisher: 'Similarweb',
        reliability_tier: 'high',
        limitation_note: 'Paid panel estimate',
      });
    } catch (err) {
      expect((err as Error & { code: string }).code).toBe('reliability_capped');
    }
  });
});
