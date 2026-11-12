import { describe, it, expect } from 'vitest';
import {
  dashboardRange,
  shiftYmd,
  saigonTodayYmd,
  countInRange,
  groupCountByDay,
  fmtDateDmy,
} from './dashboard-range';

describe('dashboard-range', () => {
  // 11:00 12/11/2026 Asia/Saigon = 04:00 UTC
  const noonSaigon = new Date('2026-11-12T04:00:00.000Z');

  it('saigonTodayYmd uses Asia/Ho_Chi_Minh calendar', () => {
    expect(saigonTodayYmd(noonSaigon)).toBe('2026-11-12');
    // still 12/11 in Saigon just after midnight (17:30 previous day UTC)
    expect(saigonTodayYmd(new Date('2026-11-11T17:30:00.000Z'))).toBe('2026-11-12');
  });

  it('shiftYmd moves calendar days', () => {
    expect(shiftYmd('2026-11-12', -6)).toBe('2026-11-06');
    expect(shiftYmd('2026-11-12', -29)).toBe('2026-10-14');
    expect(shiftYmd('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('preset today / 7 / 30 / month inclusive of today', () => {
    expect(dashboardRange('today', noonSaigon)).toEqual({
      preset: 'today',
      from: '2026-11-12',
      to: '2026-11-12',
      label: 'Hôm nay',
    });
    const week = dashboardRange('7', noonSaigon);
    expect(week).toEqual({
      preset: '7',
      from: '2026-11-06',
      to: '2026-11-12',
      label: '7 ngày qua',
    });
    // 7 inclusive calendar days
    expect(
      (Date.parse(week.to) - Date.parse(week.from)) / 86400000 + 1,
    ).toBe(7);
    const month30 = dashboardRange('30', noonSaigon);
    expect(month30.from).toBe('2026-10-14');
    expect(month30.to).toBe('2026-11-12');
    expect((Date.parse(month30.to) - Date.parse(month30.from)) / 86400000 + 1).toBe(30);
    expect(dashboardRange('month', noonSaigon)).toEqual({
      preset: 'month',
      from: '2026-11-01',
      to: '2026-11-12',
      label: 'Tháng này',
    });
  });

  it('countInRange and groupCountByDay inclusive bounds', () => {
    const rows = [
      { created_at: '2026-11-05T20:00:00+07:00' }, // 05/11
      { created_at: '2026-11-06T00:30:00+07:00' }, // 06/11 — first day of 7
      { created_at: '2026-11-12T23:00:00+07:00' }, // 12/11
      { created_at: '2026-11-13T00:30:00+07:00' }, // 13/11 outside
    ];
    const dayOf = (r: { created_at: string }) => r.created_at.slice(0, 10);
    // Use explicit YMD already in +07
    expect(countInRange(rows, '2026-11-06', '2026-11-12', dayOf)).toBe(2);
    const grouped = groupCountByDay(rows, '2026-11-06', '2026-11-12', dayOf);
    expect(grouped.get('2026-11-06')).toBe(1);
    expect(grouped.get('2026-11-12')).toBe(1);
    expect(grouped.get('2026-11-05')).toBeUndefined();
  });

  it('fmtDateDmy formats ISO as dd/mm/yyyy', () => {
    expect(fmtDateDmy('2026-11-11')).toBe('11/11/2026');
    expect(fmtDateDmy('2026-11-11T22:03:00Z')).toBe('11/11/2026');
    expect(fmtDateDmy('')).toBe('—');
    expect(fmtDateDmy(null)).toBe('—');
  });
});
