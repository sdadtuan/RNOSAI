import {
  TOWER_DEPT_CATALOG,
  buildOrgRollup,
  resolveExceptionDepartment,
} from './ceo-tower-org.util';
import type { TowerException, TowerSensorId } from './ceo-tower.types';

const ALL_SENSORS: TowerSensorId[] = [
  'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12',
];

function ex(partial: Partial<TowerException> & Pick<TowerException, 'sensor_ids'>): TowerException {
  return {
    factory: 'A',
    column_id: 'lead_b2',
    severity: 'red',
    title_vi: 'Test',
    entity_type: 'lead',
    entity_id: 1,
    owner_name: 'AM',
    age_label: '1h',
    value_vnd: null,
    department_code: null,
    team_code: null,
    position_code: null,
    job_function: null,
    href: '/crm/leads/1',
    suggest_action: null,
    suggest_params: null,
    ...partial,
  };
}

describe('ceo-tower-org.util', () => {
  describe('resolveExceptionDepartment', () => {
    it('prefers explicit department_code on exception', () => {
      expect(
        resolveExceptionDepartment({
          sensor_ids: ['S1'],
          department_code: 'DEPT-CSKH',
          factory: 'B',
        }),
      ).toBe('DEPT-CSKH');
    });

    it.each([
      ['S1', 'DEPT-SALES'],
      ['S2', 'DEPT-SALES'],
      ['S3', 'DEPT-SOLUTION'],
      ['S4', 'DEPT-SALES'],
      ['S5', 'DEPT-SOLUTION'],
      ['S6', 'DEPT-AGENCY'],
      ['S7', 'DEPT-AGENCY'],
      ['S8', 'DEPT-SALES'],
      ['S9', 'DEPT-CSKH'],
      ['S10', 'DEPT-SALES'],
      ['S12', 'DEPT-SALES'],
    ] as const)('maps %s → %s', (sensor, dept) => {
      expect(
        resolveExceptionDepartment({
          sensor_ids: [sensor],
          department_code: null,
          factory: 'A',
        }),
      ).toBe(dept);
    });

    it('S11 maps to no department (company rollup only)', () => {
      expect(
        resolveExceptionDepartment({
          sensor_ids: ['S11'],
          department_code: null,
          factory: 'A',
        }),
      ).toBeNull();
    });

    it('every DEPT-* has outside_cycle or ≥1 sensor mapped', () => {
      const mappedDepts = new Set<string>();
      for (const sensor of ALL_SENSORS) {
        const dept = resolveExceptionDepartment({
          sensor_ids: [sensor],
          department_code: null,
          factory: 'A',
        });
        if (dept) mappedDepts.add(dept);
      }
      for (const dept of TOWER_DEPT_CATALOG) {
        expect(dept.outside_cycle || mappedDepts.has(dept.code)).toBe(true);
      }
    });
  });

  describe('buildOrgRollup', () => {
    it('always returns company + 6 departments', () => {
      const rollup = buildOrgRollup([]);
      expect(rollup[0]).toMatchObject({ level: 'company', code: 'PTT' });
      const departments = rollup.filter((row) => row.level === 'department');
      expect(departments).toHaveLength(6);
      expect(departments.map((d) => d.code)).toEqual(TOWER_DEPT_CATALOG.map((d) => d.code));
    });

    it('counts red/amber per department from sensor mapping', () => {
      const rollup = buildOrgRollup([
        ex({ sensor_ids: ['S1'], severity: 'red' }),
        ex({ sensor_ids: ['S3'], severity: 'amber', entity_id: 2 }),
        ex({ sensor_ids: ['S9'], severity: 'red', factory: 'B', entity_id: 3 }),
      ]);
      const sales = rollup.find((r) => r.code === 'DEPT-SALES');
      const solution = rollup.find((r) => r.code === 'DEPT-SOLUTION');
      const cskh = rollup.find((r) => r.code === 'DEPT-CSKH');
      expect(sales).toMatchObject({ red_count: 1, amber_count: 0 });
      expect(solution).toMatchObject({ red_count: 0, amber_count: 1 });
      expect(cskh).toMatchObject({ red_count: 1, amber_count: 0 });
      expect(rollup[0]).toMatchObject({ red_count: 2, amber_count: 1 });
    });

    it('HR/IT stay outside_cycle with zero counts even when exceptions map there', () => {
      const rollup = buildOrgRollup([
        ex({
          sensor_ids: ['S1'],
          severity: 'red',
          department_code: 'DEPT-HR',
        }),
      ]);
      const hr = rollup.find((r) => r.code === 'DEPT-HR');
      const it = rollup.find((r) => r.code === 'DEPT-IT');
      expect(hr).toMatchObject({ outside_cycle: true, red_count: 0, amber_count: 0 });
      expect(it).toMatchObject({ outside_cycle: true, red_count: 0, amber_count: 0 });
    });

    it('adds team, position, and staff rollup levels when present', () => {
      const rollup = buildOrgRollup([
        ex({
          sensor_ids: ['S1'],
          team_code: 'TEAM-SALES-AM',
          position_code: 'KD-01',
          suggest_params: { staff_id: 3, owner_staff_id: 3 },
          owner_name: 'Nguyễn V.',
        }),
      ]);
      expect(rollup.some((r) => r.level === 'team' && r.code === 'TEAM-SALES-AM')).toBe(true);
      expect(rollup.some((r) => r.level === 'position' && r.code === 'KD-01')).toBe(true);
      expect(rollup.some((r) => r.level === 'staff' && r.code === '3' && r.label_vi === 'Nguyễn V.')).toBe(
        true,
      );
    });

    it('respects factoryFilter', () => {
      const rollup = buildOrgRollup(
        [
          ex({ sensor_ids: ['S1'], factory: 'A' }),
          ex({ sensor_ids: ['S9'], factory: 'B', entity_id: 2 }),
        ],
        { factoryFilter: 'B' },
      );
      expect(rollup[0]).toMatchObject({ red_count: 1, amber_count: 0 });
      expect(rollup.find((r) => r.code === 'DEPT-SALES')?.red_count).toBe(0);
      expect(rollup.find((r) => r.code === 'DEPT-CSKH')?.red_count).toBe(1);
    });
  });
});
