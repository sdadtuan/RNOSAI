import { describe, it, expect } from 'vitest';
import { PORTAL_ADS_POLL_MS, adsLoadMode, adsUpdatedLabel, saigonHm } from './ads-live-refresh';

describe('ads-live-refresh', () => {
  it('polls every 60 seconds', () => {
    expect(PORTAL_ADS_POLL_MS).toBe(60_000);
  });

  it('formats Cập nhật lúc HH:mm in Asia/Ho_Chi_Minh', () => {
    // 07:22 UTC = 14:22 in Asia/Saigon (UTC+7)
    const at = new Date('2026-11-13T07:22:00.000Z');
    expect(saigonHm(at)).toBe('14:22');
    expect(adsUpdatedLabel(at)).toBe('Cập nhật lúc 14:22');
    expect(adsUpdatedLabel(null)).toBe('');
  });

  it('keeps old data on poll and on later user-driven reloads', () => {
    expect(adsLoadMode(false, 'user')).toBe('full');
    expect(adsLoadMode(true, 'user')).toBe('quiet');
    expect(adsLoadMode(false, 'poll')).toBe('quiet');
    expect(adsLoadMode(true, 'poll')).toBe('quiet');
  });
});
