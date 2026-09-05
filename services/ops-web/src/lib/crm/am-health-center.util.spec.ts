import { describe, expect, it } from 'vitest';
import { AM_HEALTH_BAND_KEYS, AM_HEALTH_TILES, amHealthSlaCaption } from './am-health-center.util';

describe('am-health-center', () => {
  it('defines exactly six tiles with four band labels', () => {
    expect(AM_HEALTH_TILES).toHaveLength(6);
    expect(AM_HEALTH_TILES.map((tile) => tile.label)).toEqual([
      'Healthy',
      'Watch',
      'At Risk',
      'Critical',
      'Revenue at risk',
      'Open risks',
    ]);
    expect(AM_HEALTH_BAND_KEYS).toEqual(['healthy', 'watch', 'at_risk', 'critical']);
    expect(AM_HEALTH_TILES.filter((tile) => AM_HEALTH_BAND_KEYS.includes(tile.key as typeof AM_HEALTH_BAND_KEYS[number]))).toHaveLength(
      4,
    );
    expect(AM_HEALTH_TILES.some((tile) => tile.key === 'sla' || tile.label.toLowerCase().includes('sla'))).toBe(
      false,
    );
  });

  it('formats optional SLA percent caption without becoming a tile', () => {
    expect(amHealthSlaCaption(70)).toBe('SLA 70%');
    expect(amHealthSlaCaption(null)).toBe('');
    expect(AM_HEALTH_TILES).toHaveLength(6);
  });
});
