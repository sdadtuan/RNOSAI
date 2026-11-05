import { describe, expect, it } from 'vitest';
import {
  AM_OPP_STAGES,
  amGrowthKpiSubtitle,
  amGrowthMoney,
  amGrowthNextRefreshNonce,
  amGrowthOpenStages,
  amGrowthStageLabel,
  amGrowthWeighted,
} from './am-growth.util';

describe('am-growth.util', () => {
  it('exposes exactly the five pipeline stages', () => {
    expect(AM_OPP_STAGES).toEqual(['qualify', 'propose', 'negotiate', 'won', 'lost']);
    expect(amGrowthOpenStages()).toEqual(['qualify', 'propose', 'negotiate']);
  });

  it('computes weighted value as value * probability / 100', () => {
    expect(amGrowthWeighted(200_000_000, 50)).toBe(100_000_000);
    expect(amGrowthWeighted(null, 50)).toBeNull();
    expect(amGrowthWeighted(100, null)).toBeNull();
    expect(amGrowthWeighted(0, 80)).toBe(0);
  });

  it('formats money as — when null and never invents a zero', () => {
    expect(amGrowthMoney(null)).toBe('—');
    expect(amGrowthMoney(undefined)).toBe('—');
    expect(amGrowthMoney(240_000_000)).toBe('240.000.000');
  });

  it('builds a live KPI subtitle or — when all empty', () => {
    expect(amGrowthKpiSubtitle({ pipeline_vnd: null, weighted_vnd: null, won_month_vnd: null })).toBe(
      '—',
    );
    expect(
      amGrowthKpiSubtitle({
        pipeline_vnd: 1_850_000_000,
        weighted_vnd: 890_000_000,
        won_month_vnd: 320_000_000,
      }),
    ).toMatch(/Pipeline/);
    expect(amGrowthStageLabel('qualify')).toBe('Qualify');
    expect(amGrowthStageLabel('unknown')).toBe('—');
  });

  it('increments the 360 growth refresh nonce so embedded AmGrowth remounts', () => {
    expect(amGrowthNextRefreshNonce(0)).toBe(1);
    expect(amGrowthNextRefreshNonce(4)).toBe(5);
  });
});
