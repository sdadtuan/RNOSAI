import { describe, it, expect } from 'vitest';
import { ctrPercent, fmtPct } from './format';

describe('fmtPct', () => {
  it('defaults to 1 decimal place for percentages already on a 0–100 scale', () => {
    expect(fmtPct(12.54)).toBe('12,5%');
    expect(fmtPct(0)).toBe('0%');
    expect(fmtPct(null)).toBe('—');
  });

  it('shows CTR (clicks/impressions*100) with 2 decimals', () => {
    expect(fmtPct((14 / 610) * 100, 2)).toBe('2,30%');
    expect(fmtPct((12 / 453) * 100, 2)).toBe('2,65%');
    expect(fmtPct((2 / 157) * 100, 2)).toBe('1,27%');
    expect(fmtPct((8 / 691) * 100, 2)).toBe('1,16%');
  });
});

describe('ctrPercent', () => {
  it('is clicks/impressions * 100', () => {
    expect(ctrPercent(14, 610)).toBeCloseTo(2.295081967, 8);
    expect(fmtPct(ctrPercent(14, 610), 2)).toBe('2,30%');
    expect(fmtPct(ctrPercent(12, 453), 2)).toBe('2,65%');
    expect(ctrPercent(5, 0)).toBeNull();
  });
});
