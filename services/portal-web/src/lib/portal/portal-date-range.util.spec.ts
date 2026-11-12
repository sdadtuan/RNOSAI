import { describe, it, expect } from 'vitest';
import {
  formatViDate,
  matchPreset,
  parseViDate,
  presetRange,
  saigonAddDays,
  saigonMonthStart,
} from './portal-date-range.util';

describe('Vietnamese date range', () => {
  it('formats and parses dd/mm/yyyy, rejects invalid days', () => {
    expect(formatViDate('2026-11-12')).toBe('12/11/2026');
    expect(parseViDate('12/11/2026')).toBe('2026-11-12');
    expect(parseViDate('1/2/2026')).toBe('2026-02-01');
    expect(parseViDate('2026-11-12')).toBe('2026-11-12');
    expect(parseViDate('31/02/2026')).toBeNull();
    expect(parseViDate('')).toBe('');
  });

  it('computes presets in inclusive Saigon days', () => {
    const today = '2026-11-12';
    expect(presetRange('today', today)).toEqual({ from: today, to: today });
    expect(presetRange('7d', today)).toEqual({ from: '2026-11-06', to: today });
    expect(presetRange('30d', today)).toEqual({ from: '2026-10-14', to: today });
    expect(presetRange('month', today)).toEqual({ from: '2026-11-01', to: today });
    expect(saigonMonthStart(today)).toBe('2026-11-01');
    expect(saigonAddDays(today, -6)).toBe('2026-11-06');
    expect(matchPreset('2026-11-12', '2026-11-12', today)).toBe('today');
    expect(matchPreset('2026-11-01', '2026-11-12', today)).toBe('month');
    expect(matchPreset('2026-01-01', '2026-01-02', today)).toBe('');
  });
});
