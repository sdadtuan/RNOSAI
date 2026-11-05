import {
  computeWaterfall,
  MARGIN_BLOCK_BPS,
  MARGIN_FLOOR_BPS,
  assertMarginSubmit,
} from './msos-margin.util';

describe('msos-margin.util', () => {
  it('computes waterfall without rebate in contribution', () => {
    const out = computeWaterfall({
      grossSell: 100_000_000,
      discount: 5_000_000,
      mediaCost: 60_000_000,
      makeGoodCost: 2_000_000,
      rebateAccrued: 3_000_000,
      serviceCost: 5_000_000,
    });
    expect(out.net).toBe(95_000_000);
    expect(out.contribution).toBe(28_000_000);
    expect(out.contributionBps).toBe(2947);
  });

  it('exports margin floor and block constants', () => {
    expect(MARGIN_FLOOR_BPS).toBe(2400);
    expect(MARGIN_BLOCK_BPS).toBe(1800);
  });

  it('blocks margin submit below block bps', () => {
    try {
      assertMarginSubmit(1700, false);
      fail('expected margin_blocked');
    } catch (e) {
      expect(e).toMatchObject({ response: { error: 'margin_blocked' } });
    }
  });

  it('requires director below floor bps for non-admin', () => {
    try {
      assertMarginSubmit(2000, false);
      fail('expected margin_needs_director');
    } catch (e) {
      expect(e).toMatchObject({ response: { error: 'margin_needs_director' } });
    }
  });

  it('allows admin below floor bps', () => {
    expect(() => assertMarginSubmit(2000, true)).not.toThrow();
  });
});
