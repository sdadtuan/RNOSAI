import type { TowerException } from './ceo-tower.types';
import { buildCapacityTop } from './ceo-tower-capacity.util';

function ex(
  over: Partial<TowerException> & Pick<TowerException, 'severity' | 'owner_staff_id'>,
): TowerException {
  return {
    factory: 'A',
    column_id: 'lead_b2',
    sensor_ids: ['S1'],
    title_vi: 'Lead #1',
    entity_type: 'lead',
    entity_id: 1,
    owner_name: 'Owner',
    age_label: '1h',
    value_vnd: null,
    department_code: 'DEPT-SALES',
    team_code: null,
    position_code: 'KD-01',
    job_function: null,
    href: '/crm/hub?lead_id=1',
    suggest_action: null,
    suggest_params: null,
    ...over,
  };
}

describe('ceo-tower-capacity.util', () => {
  const roster = [
    {
      staff_id: 1,
      name: 'AM An',
      department_code: 'DEPT-SALES',
      position_code: 'KD-01',
    },
    {
      staff_id: 2,
      name: 'SP Binh',
      department_code: 'DEPT-SOLUTION',
      position_code: 'MKT-01',
    },
  ];

  it('counts red/amber owned per staff_id and uses roster names', () => {
    const rows = buildCapacityTop(
      [
        ex({ owner_staff_id: 1, severity: 'red', entity_id: 1 }),
        ex({ owner_staff_id: 1, severity: 'red', entity_id: 2 }),
        ex({ owner_staff_id: 1, severity: 'red', entity_id: 3 }),
        ex({ owner_staff_id: 1, severity: 'red', entity_id: 4 }),
        ex({ owner_staff_id: 1, severity: 'red', entity_id: 5 }),
        ex({ owner_staff_id: 2, severity: 'amber', entity_id: 6 }),
      ],
      roster,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      staff_id: 1,
      name: 'AM An',
      red_owned: 5,
      amber_owned: 0,
      flag: 'amber',
    });
  });

  it('amber when red_owned >= 5 or red+amber >= 10', () => {
    const byRed = buildCapacityTop(
      Array.from({ length: 5 }, (_, i) =>
        ex({ owner_staff_id: 1, severity: 'red', entity_id: i + 1 }),
      ),
      roster,
    );
    expect(byRed[0]?.flag).toBe('amber');

    const bySum = buildCapacityTop(
      [
        ...Array.from({ length: 4 }, (_, i) =>
          ex({ owner_staff_id: 2, severity: 'red', entity_id: i + 1 }),
        ),
        ...Array.from({ length: 6 }, (_, i) =>
          ex({ owner_staff_id: 2, severity: 'amber', entity_id: i + 10 }),
        ),
      ],
      roster,
    );
    expect(bySum[0]).toMatchObject({ staff_id: 2, red_owned: 4, amber_owned: 6, flag: 'amber' });
  });

  it('red when red_owned >= 8 or red+amber >= 15', () => {
    const byRed = buildCapacityTop(
      Array.from({ length: 8 }, (_, i) =>
        ex({ owner_staff_id: 1, severity: 'red', entity_id: i + 1 }),
      ),
      roster,
    );
    expect(byRed[0]?.flag).toBe('red');

    const bySum = buildCapacityTop(
      [
        ...Array.from({ length: 7 }, (_, i) =>
          ex({ owner_staff_id: 2, severity: 'red', entity_id: i + 1 }),
        ),
        ...Array.from({ length: 8 }, (_, i) =>
          ex({ owner_staff_id: 2, severity: 'amber', entity_id: i + 20 }),
        ),
      ],
      roster,
    );
    expect(bySum[0]).toMatchObject({ staff_id: 2, red_owned: 7, amber_owned: 8, flag: 'red' });
  });

  it('omits ok staff, sorts red_owned desc, slices top 5', () => {
    const exceptions: TowerException[] = [];
    for (let staffId = 1; staffId <= 7; staffId += 1) {
      for (let i = 0; i < staffId + 4; i += 1) {
        exceptions.push(
          ex({ owner_staff_id: staffId, severity: 'red', entity_id: staffId * 100 + i }),
        );
      }
    }
    const rows = buildCapacityTop(exceptions, roster);
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.staff_id)).toEqual([7, 6, 5, 4, 3]);
    expect(rows.every((r) => r.flag === 'red' || r.flag === 'amber')).toBe(true);
  });

  it('skips exceptions without owner and falls back to suggest_params metadata', () => {
    const rows = buildCapacityTop(
      [
        ex({ owner_staff_id: null, severity: 'red', entity_id: 1 }),
        ...Array.from({ length: 5 }, (_, i) =>
          ex({
            owner_staff_id: null,
            severity: 'red',
            entity_id: i + 2,
            owner_name: 'Fallback',
            suggest_params: { owner_staff_id: 99, staff_id: 99 },
          }),
        ),
      ],
      [],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      staff_id: 99,
      name: 'Fallback',
      red_owned: 5,
      flag: 'amber',
    });
  });
});
