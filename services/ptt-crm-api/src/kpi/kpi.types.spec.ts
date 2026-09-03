import { deriveKpiRag, kpiIsOnTime, kpiUpdateDeadlineIso } from './kpi.types';

describe('deriveKpiRag', () => {
  it('returns no_data when target or actual missing', () => {
    expect(deriveKpiRag(1, null, 10)).toBe('no_data');
    expect(deriveKpiRag(1, 10, null)).toBe('no_data');
    expect(deriveKpiRag(1, 0, 5)).toBe('no_data');
  });

  it('uses 90 / 75 cutovers for higher-is-better', () => {
    expect(deriveKpiRag(1, 100, 90)).toBe('green');
    expect(deriveKpiRag(1, 100, 89.9)).toBe('yellow');
    expect(deriveKpiRag(1, 100, 75)).toBe('yellow');
    expect(deriveKpiRag(1, 100, 74.9)).toBe('red');
  });

  it('inverts via achievementPct for lower-is-better', () => {
    expect(deriveKpiRag(0, 4, 4)).toBe('green');
    expect(deriveKpiRag(0, 4, 5.34)).toBe('red');
  });
});

describe('kpiIsOnTime', () => {
  it('deadline is 16:59:59.999Z on the 5th of next month (ICT 23:59)', () => {
    expect(kpiUpdateDeadlineIso(2026, 9)).toBe('2026-10-05T16:59:59.999Z');
    expect(kpiUpdateDeadlineIso(2026, 12)).toBe('2027-01-05T16:59:59.999Z');
  });

  it('open period: actual set is on time even if updated_at is late', () => {
    const now = new Date('2026-09-20T00:00:00.000Z');
    expect(kpiIsOnTime(10, '2026-11-01T00:00:00.000Z', 2026, 9, now)).toBe(true);
    expect(kpiIsOnTime(null, '2026-09-01T00:00:00.000Z', 2026, 9, now)).toBe(false);
  });

  it('closed period: requires actual and updated_at <= deadline', () => {
    const now = new Date('2026-10-06T00:00:00.000Z');
    expect(kpiIsOnTime(10, '2026-10-05T16:59:59.999Z', 2026, 9, now)).toBe(true);
    expect(kpiIsOnTime(10, '2026-10-05T17:00:00.000Z', 2026, 9, now)).toBe(false);
    expect(kpiIsOnTime(10, null, 2026, 9, now)).toBe(false);
  });
});
