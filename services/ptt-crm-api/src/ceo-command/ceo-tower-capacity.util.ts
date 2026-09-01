import type { TowerException } from './ceo-tower.types';

export type CapacityRow = {
  staff_id: number;
  name: string;
  department_code: string | null;
  position_code: string | null;
  red_owned: number;
  amber_owned: number;
  flag: 'amber' | 'red';
};

export type TowerRosterEntry = {
  staff_id: number;
  name: string;
  department_code: string | null;
  position_code: string | null;
};

function ownerStaffIdOf(ex: TowerException): number | null {
  if (ex.owner_staff_id != null && Number.isFinite(ex.owner_staff_id) && ex.owner_staff_id > 0) {
    return ex.owner_staff_id;
  }
  const raw = ex.suggest_params?.staff_id ?? ex.suggest_params?.owner_staff_id;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function capacityFlag(red: number, amber: number): 'amber' | 'red' | 'ok' {
  if (red >= 8 || red + amber >= 15) return 'red';
  if (red >= 5 || red + amber >= 10) return 'amber';
  return 'ok';
}

export function buildCapacityTop(
  exceptions: TowerException[],
  roster: TowerRosterEntry[],
): CapacityRow[] {
  const rosterById = new Map(roster.map((row) => [row.staff_id, row]));
  const counts = new Map<
    number,
    {
      red: number;
      amber: number;
      name: string;
      department_code: string | null;
      position_code: string | null;
    }
  >();

  for (const ex of exceptions) {
    if (ex.severity !== 'red' && ex.severity !== 'amber') continue;
    const staffId = ownerStaffIdOf(ex);
    if (staffId == null) continue;

    let entry = counts.get(staffId);
    if (!entry) {
      const rosterRow = rosterById.get(staffId);
      entry = {
        red: 0,
        amber: 0,
        name: rosterRow?.name ?? (ex.owner_name || `#${staffId}`),
        department_code: rosterRow?.department_code ?? ex.department_code,
        position_code: rosterRow?.position_code ?? ex.position_code,
      };
      counts.set(staffId, entry);
    }
    if (ex.severity === 'red') entry.red += 1;
    else entry.amber += 1;
  }

  const rows: CapacityRow[] = [];
  for (const [staff_id, entry] of counts) {
    const flag = capacityFlag(entry.red, entry.amber);
    if (flag === 'ok') continue;
    rows.push({
      staff_id,
      name: entry.name,
      department_code: entry.department_code,
      position_code: entry.position_code,
      red_owned: entry.red,
      amber_owned: entry.amber,
      flag,
    });
  }

  rows.sort((a, b) => {
    if (b.red_owned !== a.red_owned) return b.red_owned - a.red_owned;
    if (b.amber_owned !== a.amber_owned) return b.amber_owned - a.amber_owned;
    return a.staff_id - b.staff_id;
  });

  return rows.slice(0, 5);
}
