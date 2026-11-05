import { describe, expect, it } from 'vitest';
import type { TowerException } from '@/lib/crm/ceo-tower-api';
import {
  buildLensEntriesFromExceptions,
  filterTowerExceptions,
  resolveExceptionDepartment,
} from './ceo-tower-filter.util';

function ex(partial: Partial<TowerException> & Pick<TowerException, 'severity'>): TowerException {
  return {
    factory: 'A',
    column_id: 'lead_b2',
    sensor_ids: ['S1'],
    title_vi: 'Test',
    entity_type: 'lead',
    entity_id: 1,
    owner_staff_id: null,
    owner_name: '',
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

describe('ceo-tower-filter.util', () => {
  it('resolveExceptionDepartment maps sensor when department_code missing', () => {
    expect(resolveExceptionDepartment(ex({ sensor_ids: ['S4'], department_code: null }))).toBe('DEPT-SALES');
    expect(resolveExceptionDepartment(ex({ sensor_ids: ['S1'], department_code: 'DEPT-CSKH' }))).toBe('DEPT-CSKH');
  });

  it('filterTowerExceptions applies org drill filters', () => {
    const rows = [
      ex({ entity_id: 1, department_code: 'DEPT-SALES', team_code: 'TEAM-A', severity: 'red' }),
      ex({ entity_id: 2, department_code: 'DEPT-AGENCY', team_code: 'TEAM-B', severity: 'red' }),
    ];
    expect(filterTowerExceptions(rows, { department: 'DEPT-SALES' })).toHaveLength(1);
    expect(filterTowerExceptions(rows, { department: 'DEPT-SALES', team: 'TEAM-A' })).toHaveLength(1);
    expect(filterTowerExceptions(rows, { department: 'DEPT-SALES', team: 'TEAM-B' })).toHaveLength(0);
  });

  it('buildLensEntriesFromExceptions groups teams', () => {
    const rows = [
      ex({ team_code: 'TEAM-A', severity: 'red' }),
      ex({ entity_id: 2, team_code: 'TEAM-A', severity: 'amber' }),
      ex({ entity_id: 3, team_code: 'TEAM-B', severity: 'red' }),
    ];
    const teams = buildLensEntriesFromExceptions(rows, 'team');
    expect(teams).toHaveLength(2);
    expect(teams[0]).toMatchObject({ code: 'TEAM-A', red_count: 1, amber_count: 1 });
  });
});
