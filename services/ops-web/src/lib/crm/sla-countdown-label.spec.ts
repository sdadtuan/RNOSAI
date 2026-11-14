import { describe, expect, it } from 'vitest';
import { formatCompactCountdown, formatCompactSlaLine } from './sla-countdown-label';

describe('formatCompactCountdown', () => {
  it('omits seconds and drops empty bigger units', () => {
    expect(formatCompactCountdown(7 * 3600_000 + 59 * 60_000 + 48_000)).toBe('Còn 7h 59p');
    expect(formatCompactCountdown(13 * 3600_000 + 21 * 60_000)).toBe('Còn 13h 21p');
    expect(formatCompactCountdown(1 * 24 * 3600_000 + 13 * 3600_000 + 21 * 60_000)).toBe('Còn 1n 13h 21p');
    expect(formatCompactCountdown(45 * 60_000)).toBe('Còn 45p');
  });

  it('labels overdue the same way', () => {
    expect(formatCompactCountdown(-(8 * 60_000))).toBe('Quá hạn 8p');
  });
});

describe('formatCompactSlaLine', () => {
  it('matches the compact one-line style without seconds', () => {
    const due = '2026-11-14T20:09:31.475Z'; // 03:09 15/11/2026 Asia/Saigon
    const line = formatCompactSlaLine('Hạn phản hồi khách', 7 * 3600_000 + 59 * 60_000 + 48_000, due);
    expect(line).toBe('Hạn phản hồi khách · Còn 7h 59p (03:09 15/11/2026)');
    expect(line).not.toContain(':31');
    expect(line).not.toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});
