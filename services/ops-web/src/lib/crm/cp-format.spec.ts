import { describe, expect, it } from 'vitest';
import { dash, hasTrendData, KPI_TILES, normalizeCpHref } from './cp-format';

describe('KPI_TILES', () => {
  it('defines the eight overview KPI tiles in contract order', () => {
    expect(KPI_TILES).toHaveLength(8);
    expect(KPI_TILES[0].key).toBe('videos_created');
    expect(KPI_TILES.map((tile) => tile.key)).toEqual([
      'videos_created',
      'videos_approved',
      'render_success_rate',
      'render_avg_duration_sec',
      'credits_used',
      'credits_remaining',
      'assets_expiring',
      'tasks_overdue',
    ]);
  });
});

describe('hasTrendData', () => {
  it('hides a trend whose series are all null', () => {
    expect(hasTrendData([{ created: null, approved: null, published: null }])).toBe(false);
  });

  it('shows a trend when any series has a value', () => {
    expect(hasTrendData([{ created: null, approved: 0, published: null }])).toBe(true);
  });
});

describe('normalizeCpHref', () => {
  it('drops an unsupported review suffix from video action hrefs', () => {
    expect(normalizeCpHref('/cp/videos/video-123/review')).toBe(
      '/crm/creative-os/video/video-123',
    );
  });
});

describe('dash', () => {
  it('renders nullish values as an em dash', () => {
    expect(dash(null)).toBe('—');
  });

  it('preserves zero', () => {
    expect(dash(0)).toBe('0');
  });
});
