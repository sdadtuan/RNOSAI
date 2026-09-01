import type { TowerException, TowerFactory, TowerPayload, TowerSensorId } from './ceo-tower.types';

export const TOWER_DEPT_CATALOG = [
  { code: 'DEPT-SALES', label_vi: 'Kinh doanh', outside_cycle: false },
  { code: 'DEPT-SOLUTION', label_vi: 'Solution / MKT', outside_cycle: false },
  { code: 'DEPT-CSKH', label_vi: 'CSKH', outside_cycle: false },
  { code: 'DEPT-AGENCY', label_vi: 'Agency', outside_cycle: false },
  { code: 'DEPT-HR', label_vi: 'Nhân sự', outside_cycle: true },
  { code: 'DEPT-IT', label_vi: 'IT / Admin', outside_cycle: true },
] as const;

export type TowerDeptCode = (typeof TOWER_DEPT_CATALOG)[number]['code'];

const SENSOR_DEPT_MAP: Partial<Record<TowerSensorId, TowerDeptCode>> = {
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

export function resolveExceptionDepartment(ex: {
  sensor_ids: TowerSensorId[];
  department_code: string | null;
  factory: TowerFactory;
}): string | null {
  if (ex.department_code) return ex.department_code;
  for (const sensorId of ex.sensor_ids) {
    if (sensorId === 'S11') continue;
    const mapped = SENSOR_DEPT_MAP[sensorId];
    if (mapped) return mapped;
  }
  return null;
}

type RollupEntry = TowerPayload['org_rollup'][number];

function bump(counts: { red: number; amber: number }, severity: TowerException['severity']): void {
  if (severity === 'red') counts.red += 1;
  else if (severity === 'amber') counts.amber += 1;
}

function staffIdOf(ex: TowerException): string | null {
  const raw = ex.suggest_params?.staff_id ?? ex.suggest_params?.owner_staff_id;
  if (raw == null || raw === '') return null;
  return String(raw);
}

export function buildOrgRollup(
  exceptions: TowerException[],
  opts?: { factoryFilter?: 'A' | 'B' | 'both' },
): TowerPayload['org_rollup'] {
  const factoryFilter = opts?.factoryFilter ?? 'both';
  const filtered =
    factoryFilter === 'both'
      ? exceptions
      : exceptions.filter((ex) => ex.factory === factoryFilter);

  let companyRed = 0;
  let companyAmber = 0;
  const deptCounts = new Map<string, { red: number; amber: number }>();
  for (const dept of TOWER_DEPT_CATALOG) {
    deptCounts.set(dept.code, { red: 0, amber: 0 });
  }
  const teamCounts = new Map<string, { red: number; amber: number; label_vi: string }>();
  const positionCounts = new Map<string, { red: number; amber: number; label_vi: string }>();
  const staffCounts = new Map<string, { red: number; amber: number; label_vi: string }>();

  for (const ex of filtered) {
    if (ex.severity !== 'red' && ex.severity !== 'amber') continue;

    if (ex.severity === 'red') companyRed += 1;
    else companyAmber += 1;

    const deptCode = resolveExceptionDepartment(ex);
    if (deptCode) {
      const catalog = TOWER_DEPT_CATALOG.find((d) => d.code === deptCode);
      if (catalog && !catalog.outside_cycle) {
        const counts = deptCounts.get(deptCode);
        if (counts) bump(counts, ex.severity);
      }
    }

    if (ex.team_code) {
      const entry = teamCounts.get(ex.team_code) ?? {
        red: 0,
        amber: 0,
        label_vi: ex.team_code,
      };
      bump(entry, ex.severity);
      teamCounts.set(ex.team_code, entry);
    }

    if (ex.position_code) {
      const entry = positionCounts.get(ex.position_code) ?? {
        red: 0,
        amber: 0,
        label_vi: ex.position_code,
      };
      bump(entry, ex.severity);
      positionCounts.set(ex.position_code, entry);
    }

    const staffId = staffIdOf(ex);
    if (staffId) {
      const label = ex.owner_name?.trim() || staffId;
      const entry = staffCounts.get(staffId) ?? { red: 0, amber: 0, label_vi: label };
      bump(entry, ex.severity);
      if (ex.owner_name?.trim()) entry.label_vi = ex.owner_name.trim();
      staffCounts.set(staffId, entry);
    }
  }

  const out: RollupEntry[] = [
    {
      level: 'company',
      code: 'PTT',
      label_vi: 'PTT',
      red_count: companyRed,
      amber_count: companyAmber,
    },
  ];

  for (const dept of TOWER_DEPT_CATALOG) {
    const counts = deptCounts.get(dept.code) ?? { red: 0, amber: 0 };
    out.push({
      level: 'department',
      code: dept.code,
      label_vi: dept.label_vi,
      red_count: dept.outside_cycle ? 0 : counts.red,
      amber_count: dept.outside_cycle ? 0 : counts.amber,
      ...(dept.outside_cycle ? { outside_cycle: true } : {}),
    });
  }

  const bySeverity = (a: { red: number; amber: number }, b: { red: number; amber: number }) =>
    b.red - a.red || b.amber - a.amber;

  for (const [code, counts] of [...teamCounts.entries()].sort((a, b) =>
    bySeverity(a[1], b[1]),
  )) {
    out.push({
      level: 'team',
      code,
      label_vi: counts.label_vi,
      red_count: counts.red,
      amber_count: counts.amber,
    });
  }

  for (const [code, counts] of [...positionCounts.entries()].sort((a, b) =>
    bySeverity(a[1], b[1]),
  )) {
    out.push({
      level: 'position',
      code,
      label_vi: counts.label_vi,
      red_count: counts.red,
      amber_count: counts.amber,
    });
  }

  for (const [code, counts] of [...staffCounts.entries()].sort((a, b) =>
    bySeverity(a[1], b[1]),
  )) {
    out.push({
      level: 'staff',
      code,
      label_vi: counts.label_vi,
      red_count: counts.red,
      amber_count: counts.amber,
    });
  }

  return out;
}

export function exceptionMatchesOrgFilters(
  ex: TowerException,
  filters: {
    department?: string;
    team?: string;
    position_code?: string;
    staff_id?: string;
  },
): boolean {
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
}
