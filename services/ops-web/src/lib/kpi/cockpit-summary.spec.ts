import { describe, expect, it } from 'vitest';
import { buildCockpitSummary, deptLabel, prevYearMonth } from './cockpit-summary';
import type { StaffKpiGridEntry } from '@/lib/api';

function row(p: Partial<StaffKpiGridEntry> & Pick<StaffKpiGridEntry, 'id' | 'staff_id'>): StaffKpiGridEntry {
  return {
    staff_name: 'A',
    staff_code: 'A',
    staff_department: 'Sales',
    metric_id: 1,
    metric_name: 'Lead',
    metric_code: 'LEAD',
    metric_unit: '',
    metric_higher_is_better: 1,
    target_value: 100,
    actual_value: 90,
    status: 'on_track',
    updated_at: '2026-09-10T00:00:00.000Z',
    year: 2026,
    month: 9,
    ...p,
  };
}

describe('buildCockpitSummary', () => {
  const now = new Date('2026-09-20T00:00:00.000Z');

  it('counts RAG tiles, completion, on-time, and MoM delta', () => {
    const current = [
      row({ id: 1, staff_id: 1, actual_value: 90 }),
      row({ id: 2, staff_id: 2, actual_value: 80, staff_department: 'Tech' }),
      row({ id: 3, staff_id: 3, actual_value: 50, staff_department: 'Tech' }),
    ];
    const prev = [row({ id: 9, staff_id: 1, year: 2026, month: 8, actual_value: 100 })];
    const out = buildCockpitSummary(current, prev, now);
    expect(out.green).toBe(1);
    expect(out.yellow).toBe(1);
    expect(out.red).toBe(1);
    expect(out.total).toBe(3);
    expect(out.completion_pct).toBeCloseTo((90 + 80 + 50) / 3, 5);
    expect(out.ontime_pct).toBe(100);
    expect(out.delta.green).toBe(0);
    expect(out.by_department.map((d) => d.name)).toEqual(['Sales', 'Tech']);
    expect(out.attention[0].rag).toBe('red');
    expect(out.insight.headline).toMatch(/1 KPI không đạt/);
  });

  it('labels empty department and prevYearMonth', () => {
    expect(deptLabel('')).toBe('Chưa gắn phòng');
    expect(prevYearMonth(2026, 1)).toEqual({ year: 2025, month: 12 });
  });

  it('nulls count deltas when prev period is missing', () => {
    const current = [
      row({ id: 1, staff_id: 1, actual_value: 100 }),
      row({ id: 2, staff_id: 2, actual_value: 90 }),
    ];
    const out = buildCockpitSummary(current, [], now);
    expect(out.green).toBe(2);
    expect(out.delta.green).toBeNull();
    expect(out.delta.yellow).toBeNull();
    expect(out.delta.red).toBeNull();
  });

  it('counts lower-is-better (higher=0, target=4, actual=4) as 100 completion_pct', () => {
    const current = [
      row({
        id: 1,
        staff_id: 1,
        metric_higher_is_better: 0,
        target_value: 4,
        actual_value: 4,
      }),
    ];
    const out = buildCockpitSummary(current, [], now);
    expect(out.completion_pct).toBe(100);
  });
});
