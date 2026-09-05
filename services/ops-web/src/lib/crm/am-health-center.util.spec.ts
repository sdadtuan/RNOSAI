import { describe, expect, it } from 'vitest';
import { AM_HEALTH_BAND_KEYS, AM_HEALTH_TILES } from './am-health-center.util';

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
  });
});
