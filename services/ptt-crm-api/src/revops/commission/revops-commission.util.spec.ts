import { calcCommissionVnd, pickTierRate } from './revops-commission.util';

describe('calcCommissionVnd', () => {
  it('rounds eligible × rate × split / 10000', () => {
    expect(calcCommissionVnd(100_000_000, 5, 100)).toBe(5_000_000);
    expect(calcCommissionVnd(100_000_000, 5, 50)).toBe(2_500_000);
    expect(calcCommissionVnd(99_999_999, 3.5, 100)).toBe(3_500_000);
  });
});

describe('pickTierRate', () => {
  const tiers = [
    { min_attainment_pct: 0, max_attainment_pct: 79.99, rate_pct: 3 },
    { min_attainment_pct: 80, max_attainment_pct: 99.99, rate_pct: 5 },
    { min_attainment_pct: 100, max_attainment_pct: null, rate_pct: 7 },
  ];

  it('selects tier by attainment', () => {
    expect(pickTierRate(tiers, 50)).toBe(3);
    expect(pickTierRate(tiers, 85)).toBe(5);
    expect(pickTierRate(tiers, 120)).toBe(7);
  });
});
