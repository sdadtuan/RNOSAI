import type { TowerException } from '@/lib/crm/ceo-tower-api';
import type { TowerOrgRollupEntry } from '@/lib/crm/ceo-tower-ui.util';

const SENSOR_DEPT_MAP: Partial<Record<string, string>> = {
  S1: 'DEPT-SALES',
  S2: 'DEPT-SALES',
  S3: 'DEPT-SOLUTION',
  S4: 'DEPT-SALES',
  S5: 'DEPT-SOLUTION',
  S6: 'DEPT-AGENCY',
  S7: 'DEPT-AGENCY',
  S8: 'DEPT-SALES',
  S9: 'DEPT-CSKH',
  S10: 'DEPT-SALES',
  S12: 'DEPT-SALES',
};

export type TowerDrillFilters = {
  department?: string;
  team?: string;
  position_code?: string;
  staff_id?: string;
};

export function resolveExceptionDepartment(ex: Pick<TowerException, 'sensor_ids' | 'department_code'>): string | null {
  if (ex.department_code) return ex.department_code;
  for (const sensorId of ex.sensor_ids) {
    if (sensorId === 'S11') continue;
    const mapped = SENSOR_DEPT_MAP[sensorId];
    if (mapped) return mapped;
  }
  return null;
}

function staffIdOf(ex: TowerException): string | null {
  if (ex.owner_staff_id != null && ex.owner_staff_id > 0) return String(ex.owner_staff_id);
  const raw = ex.suggest_params?.staff_id ?? ex.suggest_params?.owner_staff_id;
  if (raw == null || raw === '') return null;
  return String(raw);
}

export function filterTowerExceptions(
  exceptions: TowerException[],
  filters: TowerDrillFilters,
): TowerException[] {
  return exceptions.filter((ex) => {
    if (filters.department && resolveExceptionDepartment(ex) !== filters.department) {
      return false;
    }
    if (filters.team && ex.team_code !== filters.team) return false;
    if (filters.position_code && ex.position_code !== filters.position_code) return false;
    if (filters.staff_id) {
      const owner = staffIdOf(ex);
      if (owner !== String(filters.staff_id)) return false;
    }
    return true;
  });
}

export function buildLensEntriesFromExceptions(
  exceptions: TowerException[],
  level: 'team' | 'position' | 'staff',
): TowerOrgRollupEntry[] {
  const map = new Map<string, { red: number; amber: number; label_vi: string }>();

  for (const ex of exceptions) {
    if (ex.severity !== 'red' && ex.severity !== 'amber') continue;

    let code: string | null = null;
    let label_vi = '';

    if (level === 'team' && ex.team_code) {
      code = ex.team_code;
      label_vi = ex.team_code;
    } else if (level === 'position' && ex.position_code) {
      code = ex.position_code;
      label_vi = ex.position_code;
    } else if (level === 'staff') {
      const id = staffIdOf(ex);
      if (id) {
        code = id;
        label_vi = ex.owner_name?.trim() || id;
      }
    }

    if (!code) continue;

    const entry = map.get(code) ?? { red: 0, amber: 0, label_vi };
    if (ex.severity === 'red') entry.red += 1;
    else entry.amber += 1;
    if (ex.owner_name?.trim() && level === 'staff') entry.label_vi = ex.owner_name.trim();
    map.set(code, entry);
  }

  return [...map.entries()]
    .map(([code, counts]) => ({
      level,
      code,
      label_vi: counts.label_vi,
      red_count: counts.red,
      amber_count: counts.amber,
    }))
    .sort((a, b) => b.red_count - a.red_count || b.amber_count - a.amber_count || a.label_vi.localeCompare(b.label_vi, 'vi'));
}
