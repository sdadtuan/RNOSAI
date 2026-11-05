import { describe, expect, it } from 'vitest';
import {
  TOWER_COLUMN_DEFS,
  TOWER_EMPTY_STATE_COPY,
  TOWER_FACTORY_B_UNUSED_LABEL,
  TOWER_OUTSIDE_CYCLE_COPY,
  activeOrgLensLevel,
  orgLensLevelLabel,
  orgRollupByLevel,
  parseTowerSeverityFilter,
  towerColumnLabel,
  buildTowerBreadcrumb,
  buildTowerFunnelBars,
  buildDeptRedDonutSegments,
  deptRollupSummary,
  formatTowerWowDelta,
  towerColumnUnusedLabel,
  towerHealthTone,
} from './ceo-tower-ui.util';

describe('ceo-tower-ui.util', () => {
  it('empty-state copy reminds CEO to check degraded', () => {
    expect(TOWER_EMPTY_STATE_COPY).toBe('Không sót trong cửa sổ — kiểm tra degraded');
  });

  it('factory B unused columns use “Không dùng Factory B”', () => {
    expect(TOWER_FACTORY_B_UNUSED_LABEL).toBe('Không dùng Factory B');
    expect(towerColumnUnusedLabel('intake', 'B')).toBe(TOWER_FACTORY_B_UNUSED_LABEL);
    expect(towerColumnUnusedLabel('consult', 'B')).toBe(TOWER_FACTORY_B_UNUSED_LABEL);
    expect(towerColumnUnusedLabel('contract', 'B')).toBe(TOWER_FACTORY_B_UNUSED_LABEL);
    expect(towerColumnUnusedLabel('tmmt_deliver', 'B')).toBe(TOWER_FACTORY_B_UNUSED_LABEL);
  });

  it('factory B still uses Lead/B2 and CSKH; A and both do not hide columns', () => {
    expect(towerColumnUnusedLabel('lead_b2', 'B')).toBeNull();
    expect(towerColumnUnusedLabel('care', 'B')).toBeNull();
    expect(towerColumnUnusedLabel('intake', 'A')).toBeNull();
    expect(towerColumnUnusedLabel('contract', 'both')).toBeNull();
  });

  it('exposes all 6 column labels', () => {
    expect(TOWER_COLUMN_DEFS.map((c) => c.id)).toEqual([
      'lead_b2',
      'intake',
      'consult',
      'contract',
      'tmmt_deliver',
      'care',
    ]);
    expect(TOWER_COLUMN_DEFS.map((c) => c.label)).toEqual([
      'Lead/B2',
      'Intake',
      'Tư vấn',
      'HĐ',
      'TMMT/QA',
      'CSKH',
    ]);
  });

  it('breadcrumb shows company → factory → org levels from URL', () => {
    const orgRollup = [
      { level: 'department' as const, code: 'DEPT-SALES', label_vi: 'Kinh doanh', red_count: 2, amber_count: 0 },
      { level: 'team' as const, code: 'TEAM-SALES-AM', label_vi: 'TEAM-SALES-AM', red_count: 1, amber_count: 0 },
      { level: 'staff' as const, code: '3', label_vi: 'Nguyễn V.', red_count: 1, amber_count: 0 },
    ];
    const crumbs = buildTowerBreadcrumb({
      factory: 'A',
      department: 'DEPT-SALES',
      team: 'TEAM-SALES-AM',
      staff_id: '3',
      orgRollup,
    });
    expect(crumbs.map((c) => c.label)).toEqual([
      'Công ty',
      'A Agency',
      'Kinh doanh',
      'TEAM-SALES-AM',
      'Nguyễn V.',
    ]);
  });

  it('outside-cycle copy points CEO to staff/admin', () => {
    expect(TOWER_OUTSIDE_CYCLE_COPY).toContain('/crm/staff');
    expect(TOWER_OUTSIDE_CYCLE_COPY).toContain('/admin');
  });

  it('deptRollupSummary formats red/amber or outside cycle', () => {
    expect(deptRollupSummary({ level: 'department', code: 'DEPT-SALES', label_vi: 'Sales', red_count: 2, amber_count: 1 })).toBe('2đ · 1v');
    expect(deptRollupSummary({ level: 'department', code: 'DEPT-HR', label_vi: 'HR', red_count: 0, amber_count: 0, outside_cycle: true })).toBe('ngoài chu trình');
  });

  it('buildTowerFunnelBars marks bottleneck and scales bar height', () => {
    const bars = buildTowerFunnelBars(
      [
        { column_id: 'lead_b2', red_count: 1, amber_count: 0, ok_count: 10, header_severity: 'red' },
        { column_id: 'intake', red_count: 0, amber_count: 3, ok_count: 8, header_severity: 'amber' },
        { column_id: 'consult', red_count: 0, amber_count: 0, ok_count: 5, header_severity: 'ok' },
        { column_id: 'contract', red_count: 2, amber_count: 0, ok_count: 4, header_severity: 'red' },
        { column_id: 'tmmt_deliver', red_count: 0, amber_count: 1, ok_count: 3, header_severity: 'amber' },
        { column_id: 'care', red_count: 0, amber_count: 0, ok_count: 2, header_severity: 'ok' },
      ],
      'both',
    );
    const contract = bars.find((bar) => bar.columnId === 'contract');
    expect(contract?.isBottleneck).toBe(true);
    expect(contract?.barHeightPct).toBe(100);
    expect(bars.find((bar) => bar.columnId === 'consult')?.barHeightPct).toBe(12);
  });

  it('towerHealthTone reflects red vs amber-only issues', () => {
    expect(towerHealthTone(0, 0)).toBe('ok');
    expect(towerHealthTone(2, 0)).toBe('warn');
    expect(towerHealthTone(3, 1)).toBe('critical');
  });

  it('formatTowerWowDelta shows signed delta', () => {
    expect(formatTowerWowDelta({ delta: 0, direction: 'flat' })).toBe('±0');
    expect(formatTowerWowDelta({ delta: 2, direction: 'up' })).toBe('+2');
    expect(formatTowerWowDelta({ delta: -1, direction: 'down' })).toBe('-1');
  });

  it('buildDeptRedDonutSegments shares red counts by department', () => {
    const segments = buildDeptRedDonutSegments([
      { level: 'department', code: 'DEPT-SALES', label_vi: 'Sales', red_count: 2, amber_count: 1 },
      { level: 'department', code: 'DEPT-AGENCY', label_vi: 'Agency', red_count: 1, amber_count: 0 },
      { level: 'department', code: 'DEPT-HR', label_vi: 'HR', red_count: 0, amber_count: 0, outside_cycle: true },
    ]);
    expect(segments).toHaveLength(2);
    expect(segments[0]?.value).toBe(2);
    expect(segments[1]?.value).toBe(1);
    expect(segments.reduce((sum, seg) => sum + seg.pct, 0)).toBe(100);
  });

  it('activeOrgLensLevel advances drill depth', () => {
    expect(activeOrgLensLevel({})).toBe('department');
    expect(activeOrgLensLevel({ department: 'DEPT-SALES' })).toBe('team');
    expect(activeOrgLensLevel({ department: 'DEPT-SALES', team: 'TEAM-1' })).toBe('position');
    expect(activeOrgLensLevel({ department: 'D', team: 'T', position_code: 'P' })).toBe('staff');
    expect(activeOrgLensLevel({ department: 'D', team: 'T', position_code: 'P', staff_id: '3' })).toBeNull();
  });

  it('towerColumnLabel maps column ids', () => {
    expect(towerColumnLabel('contract')).toBe('HĐ');
    expect(towerColumnLabel('unknown')).toBe('unknown');
  });

  it('parseTowerSeverityFilter defaults to red and amber', () => {
    expect(parseTowerSeverityFilter(null)).toBe('red,amber');
    expect(parseTowerSeverityFilter('red')).toBe('red');
  });
});
