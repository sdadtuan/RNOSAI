import {
  calendarDaysBetween,
  calendarMinutesBetween,
  computeK1,
  computeK2,
  computeK3,
  computeK4Compliance,
  median,
} from './lifecycle-kpi.util';

describe('lifecycle-kpi.util', () => {
  it('median returns null for empty input', () => {
    expect(median([])).toBeNull();
  });

  it('median returns middle value for odd count', () => {
    expect(median([10, 30, 20])).toBe(20);
  });

  it('median averages middle pair for even count', () => {
    expect(median([10, 20, 30, 40])).toBe(25);
  });

  it('calendarMinutesBetween rejects negative duration', () => {
    expect(calendarMinutesBetween('2026-08-02T10:00:00Z', '2026-08-02T09:00:00Z')).toBe(-1);
  });

  it('computeK1 returns median minutes', () => {
    const out = computeK1([
      { created_at: '2026-08-01T08:00:00Z', b2_at: '2026-08-01T09:00:00Z' },
      { created_at: '2026-08-01T08:00:00Z', b2_at: '2026-08-01T10:00:00Z' },
    ]);
    expect(out.n).toBe(2);
    expect(out.median_minutes).toBe(90);
  });

  it('computeK2/K3 use calendar day diff', () => {
    expect(calendarDaysBetween('2026-08-01T08:00:00Z', '2026-08-04T08:00:00Z')).toBe(3);
    const k2 = computeK2([
      { b2_at: '2026-08-01T08:00:00Z', intake_at: '2026-08-03T08:00:00Z' },
    ]);
    expect(k2.median_days).toBe(2);
    const k3 = computeK3([
      { contract_at: '2026-08-01T08:00:00Z', client_at: '2026-08-08T08:00:00Z' },
    ]);
    expect(k3.median_days).toBe(7);
  });

  it('computeK4Compliance returns pct', () => {
    expect(computeK4Compliance({ ok: 17, breach: 3 })).toEqual({ pct: 85, n: 20 });
    expect(computeK4Compliance({ ok: 0, breach: 0 })).toEqual({ pct: null, n: 0 });
  });
});
