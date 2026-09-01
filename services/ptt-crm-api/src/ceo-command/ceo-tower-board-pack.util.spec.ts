import type { TowerPayload } from './ceo-tower.types';
import {
  buildBoardPackFacts,
  buildBoardPackDeptRedDonut,
  defaultBoardPackWeekLabel,
  isoWeekPartsFromYmd,
  resolveBoardPackWeek,
  ymdInIct,
} from './ceo-tower-board-pack.util';

function samplePayload(over: Partial<TowerPayload> = {}): TowerPayload {
  return {
    ok: true,
    generated_at: '2026-09-01T07:00:00.000Z',
    window_exception_days: 7,
    k_strip: [
      { key: 'k1', value: 12, status: 'green', href: '/crm/owner-weekly' },
      { key: 'k2', value: 3, status: 'amber', href: '/crm/owner-weekly' },
      { key: 'k3', value: 1, status: 'red', href: '/crm/owner-weekly' },
      { key: 'k4', value: null, status: 'neutral', href: '/crm/owner-weekly' },
    ],
    columns: [
      {
        column_id: 'lead_b2',
        red_count: 2,
        amber_count: 1,
        ok_count: 0,
        header_severity: 'red',
      },
      {
        column_id: 'intake',
        red_count: 0,
        amber_count: 1,
        ok_count: 0,
        header_severity: 'amber',
      },
      {
        column_id: 'consult',
        red_count: 0,
        amber_count: 0,
        ok_count: 0,
        header_severity: 'ok',
      },
      {
        column_id: 'contract',
        red_count: 1,
        amber_count: 0,
        ok_count: 0,
        header_severity: 'red',
      },
      {
        column_id: 'tmmt_deliver',
        red_count: 0,
        amber_count: 0,
        ok_count: 0,
        header_severity: 'ok',
      },
      {
        column_id: 'care',
        red_count: 0,
        amber_count: 2,
        ok_count: 0,
        header_severity: 'amber',
      },
    ],
    exceptions: Array.from({ length: 12 }, (_, i) => ({
      factory: 'A' as const,
      column_id: 'lead_b2' as const,
      sensor_ids: ['S1' as const],
      severity: 'red' as const,
      title_vi: `Lead #${i + 1}`,
      entity_type: 'lead' as const,
      entity_id: i + 1,
      owner_staff_id: 1,
      owner_name: 'Owner',
      age_label: '2h',
      value_vnd: 1_000_000,
      department_code: 'DEPT-SALES',
      team_code: null,
      position_code: null,
      job_function: null,
      href: `/crm/hub?lead_id=${i + 1}`,
      suggest_action: null,
      suggest_params: null,
    })),
    org_rollup: [
      { level: 'company', code: 'PTT', label_vi: 'PTT', red_count: 3, amber_count: 4 },
      {
        level: 'department',
        code: 'DEPT-SALES',
        label_vi: 'Kinh doanh',
        red_count: 2,
        amber_count: 1,
      },
      {
        level: 'department',
        code: 'DEPT-SOLUTION',
        label_vi: 'Solution / MKT',
        red_count: 0,
        amber_count: 1,
      },
      {
        level: 'department',
        code: 'DEPT-CSKH',
        label_vi: 'CSKH',
        red_count: 0,
        amber_count: 2,
      },
      {
        level: 'department',
        code: 'DEPT-AGENCY',
        label_vi: 'Agency',
        red_count: 1,
        amber_count: 0,
      },
      {
        level: 'department',
        code: 'DEPT-HR',
        label_vi: 'Nhân sự',
        red_count: 0,
        amber_count: 0,
        outside_cycle: true,
      },
      {
        level: 'department',
        code: 'DEPT-IT',
        label_vi: 'IT / Admin',
        red_count: 0,
        amber_count: 0,
        outside_cycle: true,
      },
    ],
    next_cursor: 'lead:11',
    degraded: [{ source: 'finance', reason: 'timeout' }],
    sensors_ok: {
      S1: 'fail',
      S2: 'ok',
      S3: 'ok',
      S4: 'ok',
      S5: 'ok',
      S6: 'ok',
      S7: 'ok',
      S8: 'ok',
      S9: 'ok',
      S10: 'ok',
      S11: 'fail',
      S12: 'ok',
    },
    finance_strip: [
      {
        key: 'cash',
        label_vi: 'Tiền mặt',
        value: 60_000_000,
        status: 'green',
        href: '/crm/owner-weekly',
      },
      {
        key: 'ar',
        label_vi: 'AR quá hạn',
        value: 20_000_000,
        status: 'green',
        href: '/crm/owner-weekly',
      },
      {
        key: 'dt30',
        label_vi: 'DT 30 ngày',
        value: 15_000_000,
        status: 'neutral',
        href: '/crm/owner-weekly',
      },
      {
        key: 'top1',
        label_vi: 'Top-1 DT',
        value: 45,
        status: 'red',
        href: '/crm/owner-weekly',
      },
      {
        key: 'gm',
        label_vi: 'GM',
        value: 32,
        status: 'green',
        href: '/crm/owner-weekly',
      },
    ],
    capacity_top: [
      {
        staff_id: 1,
        name: 'AM An',
        department_code: 'DEPT-SALES',
        position_code: 'KD-01',
        red_owned: 8,
        amber_owned: 2,
        flag: 'red',
      },
    ],
    trends: {
      series: {
        labels: ['T3', 'T4', 'T5', 'T6', 'T7', 'CN', 'T2'],
        total_issues: [2, 3, 3, 4, 5, 6, 7],
        red_issues: [1, 1, 2, 2, 3, 3, 3],
        by_column: {
          lead_b2: [1, 1, 1, 1, 1, 1, 1],
          intake: [0, 0, 0, 0, 0, 0, 0],
          consult: [0, 0, 0, 0, 0, 0, 0],
          contract: [1, 1, 1, 2, 2, 2, 2],
          tmmt_deliver: [0, 1, 1, 1, 2, 2, 2],
          care: [0, 0, 0, 0, 0, 0, 0],
        },
      },
      wow: {
        current_total: 7,
        prev_week_total: 2,
        delta: 5,
        direction: 'up',
      },
    },
    ...over,
  };
}

describe('ceo-tower-board-pack.util', () => {
  it('resolveBoardPackWeek accepts YYYY-Www or defaults ICT ISO week', () => {
    expect(resolveBoardPackWeek('2026-W36')).toBe('2026-W36');
    expect(resolveBoardPackWeek('', new Date('2026-09-01T10:00:00.000Z'))).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('ymdInIct + isoWeekPartsFromYmd align for a known ICT date', () => {
    const ymd = ymdInIct(new Date('2026-09-01T10:00:00.000Z'));
    expect(ymd).toBe('2026-09-01');
    const parts = isoWeekPartsFromYmd(ymd);
    expect(defaultBoardPackWeekLabel(new Date('2026-09-01T10:00:00.000Z'))).toBe(
      `${parts.isoYear}-W${String(parts.isoWeek).padStart(2, '0')}`,
    );
  });

  it('buildBoardPackFacts contains all required keys and caps top 10 exceptions', () => {
    const facts = buildBoardPackFacts(samplePayload(), '2026-W36');

    expect(facts.week).toBe('2026-W36');
    expect(facts.k_strip).toHaveLength(4);
    expect(facts.columns).toHaveLength(6);
    expect(facts.departments).toHaveLength(6);
    expect(facts.top_exceptions).toHaveLength(10);
    expect(facts.finance).toHaveLength(5);
    expect(facts.capacity_top).toHaveLength(1);
    expect(facts.s11_fail).toBe(true);
    expect(facts.s12_fail).toBe(false);
    expect(facts.degraded).toEqual([{ source: 'finance', reason: 'timeout' }]);
    expect(facts.decisions_blank).toEqual(['', '', '']);
    expect(facts.trends).toEqual({
      labels: ['T3', 'T4', 'T5', 'T6', 'T7', 'CN', 'T2'],
      total_issues: [2, 3, 3, 4, 5, 6, 7],
      red_issues: [1, 1, 2, 2, 3, 3, 3],
      wow: {
        current_total: 7,
        prev_week_total: 2,
        delta: 5,
        direction: 'up',
      },
    });
    expect(facts.dept_red_donut).toEqual([
      expect.objectContaining({ code: 'DEPT-SALES', value: 2 }),
      expect.objectContaining({ code: 'DEPT-AGENCY', value: 1 }),
    ]);

    const requiredKeys = [
      'week',
      'k_strip',
      'columns',
      'departments',
      'top_exceptions',
      'finance',
      'capacity_top',
      's11_fail',
      's12_fail',
      'degraded',
      'decisions_blank',
    ];
    for (const key of requiredKeys) {
      expect(facts).toHaveProperty(key);
    }
  });

  it('omits finance when finance_strip absent', () => {
    const facts = buildBoardPackFacts(samplePayload({ finance_strip: undefined }), '2026-W36');
    expect(facts.finance).toBeUndefined();
  });

  it('buildBoardPackDeptRedDonut skips outside-cycle departments', () => {
    const segments = buildBoardPackDeptRedDonut([
      { code: 'DEPT-SALES', label_vi: 'Sales', red_count: 2 },
      { code: 'DEPT-HR', label_vi: 'HR', red_count: 5, outside_cycle: true },
    ]);
    expect(segments).toHaveLength(1);
    expect(segments[0]?.pct).toBe(100);
  });

  // Optional e2e: open /crm/ceo/board-pack, verify print layout and numbers match facts_json.
});
