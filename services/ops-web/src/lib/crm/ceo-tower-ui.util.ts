export const TOWER_EMPTY_STATE_COPY = 'Không sót trong cửa sổ — kiểm tra degraded';
export const TOWER_OUTSIDE_CYCLE_COPY =
  'Không theo dõi trên tháp — mở /crm/staff hoặc /admin';
export const TOWER_FACTORY_B_UNUSED_LABEL = 'Không dùng Factory B';

export type TowerFactoryFilter = 'A' | 'B' | 'both';
export type TowerOrgRollupEntry = {
  level: 'company' | 'factory' | 'department' | 'team' | 'position' | 'staff';
  code: string;
  label_vi: string;
  red_count: number;
  amber_count: number;
  outside_cycle?: boolean;
};

export type TowerBreadcrumbSegment = {
  key: string;
  label: string;
  clearTo?: Record<string, string | null>;
};

export const TOWER_ORG_FILTER_KEYS = [
  'department',
  'team',
  'position_code',
  'staff_id',
] as const;

export function departmentRollupEntries(
  orgRollup: TowerOrgRollupEntry[] | undefined,
): TowerOrgRollupEntry[] {
  return (orgRollup ?? []).filter((row) => row.level === 'department');
}

export function deptRollupSummary(row: TowerOrgRollupEntry): string {
  if (row.outside_cycle) return 'ngoài chu trình';
  const parts: string[] = [];
  if (row.red_count > 0) parts.push(`${row.red_count}đ`);
  if (row.amber_count > 0) parts.push(`${row.amber_count}v`);
  return parts.length ? parts.join(' · ') : '0';
}

export function isOutsideCycleDepartment(
  department: string | null | undefined,
  orgRollup: TowerOrgRollupEntry[] | undefined,
): boolean {
  if (!department) return false;
  const row = departmentRollupEntries(orgRollup).find((d) => d.code === department);
  return Boolean(row?.outside_cycle);
}

export function buildTowerBreadcrumb(params: {
  factory: TowerFactoryFilter;
  department?: string | null;
  team?: string | null;
  position_code?: string | null;
  staff_id?: string | null;
  orgRollup?: TowerOrgRollupEntry[];
}): TowerBreadcrumbSegment[] {
  const segments: TowerBreadcrumbSegment[] = [
    {
      key: 'company',
      label: 'Công ty',
      clearTo: Object.fromEntries(TOWER_ORG_FILTER_KEYS.map((k) => [k, null])),
    },
  ];

  if (params.factory !== 'both') {
    segments.push({
      key: 'factory',
      label: params.factory === 'A' ? 'A Agency' : 'B CSKH',
      clearTo: { factory: 'both', ...Object.fromEntries(TOWER_ORG_FILTER_KEYS.map((k) => [k, null])) },
    });
  }

  const labelFor = (level: TowerOrgRollupEntry['level'], code: string, fallback: string) =>
    params.orgRollup?.find((row) => row.level === level && row.code === code)?.label_vi ?? fallback;

  if (params.department) {
    segments.push({
      key: 'department',
      label: labelFor('department', params.department, params.department),
      clearTo: {
        department: null,
        team: null,
        position_code: null,
        staff_id: null,
      },
    });
  }
  if (params.team) {
    segments.push({
      key: 'team',
      label: labelFor('team', params.team, params.team),
      clearTo: {
        team: null,
        position_code: null,
        staff_id: null,
      },
    });
  }
  if (params.position_code) {
    segments.push({
      key: 'position',
      label: labelFor('position', params.position_code, params.position_code),
      clearTo: {
        position_code: null,
        staff_id: null,
      },
    });
  }
  if (params.staff_id) {
    segments.push({
      key: 'staff',
      label: labelFor('staff', params.staff_id, params.staff_id),
      clearTo: { staff_id: null },
    });
  }

  return segments;
}

export type TowerUiColumnId =
  | 'lead_b2'
  | 'intake'
  | 'consult'
  | 'contract'
  | 'tmmt_deliver'
  | 'care';

export const TOWER_COLUMN_DEFS: ReadonlyArray<{ id: TowerUiColumnId; label: string }> = [
  { id: 'lead_b2', label: 'Lead/B2' },
  { id: 'intake', label: 'Intake' },
  { id: 'consult', label: 'Tư vấn' },
  { id: 'contract', label: 'HĐ' },
  { id: 'tmmt_deliver', label: 'TMMT/QA' },
  { id: 'care', label: 'CSKH' },
];

const FACTORY_B_UNUSED: ReadonlySet<string> = new Set([
  'intake',
  'consult',
  'contract',
  'tmmt_deliver',
]);

export function isFactoryBUnusedColumn(columnId: string): boolean {
  return FACTORY_B_UNUSED.has(columnId);
}

export function towerColumnUnusedLabel(
  columnId: string,
  factory: TowerFactoryFilter,
): string | null {
  if (factory === 'B' && isFactoryBUnusedColumn(columnId)) {
    return TOWER_FACTORY_B_UNUSED_LABEL;
  }
  return null;
}

export function parseTowerFactory(raw: string | null | undefined): TowerFactoryFilter {
  if (raw === 'A' || raw === 'B') return raw;
  return 'both';
}

export function exceptionQueueSummary(items: Array<{ severity: string }>): {
  total: number;
  red: number;
} {
  let red = 0;
  for (const item of items) {
    if (item.severity === 'red') red += 1;
  }
  return { total: items.length, red };
}

export type TowerFunnelBar = {
  columnId: TowerUiColumnId;
  label: string;
  redCount: number;
  amberCount: number;
  okCount: number;
  totalIssues: number;
  weight: number;
  barHeightPct: number;
  isBottleneck: boolean;
  unusedLabel: string | null;
  degraded: boolean;
  headerSeverity: 'red' | 'amber' | 'ok';
};

export type TowerColumnCounts = {
  column_id: string;
  red_count: number;
  amber_count: number;
  ok_count: number;
  header_severity: 'red' | 'amber' | 'ok';
  degraded?: unknown;
};

/** Stacked-bar model for the 6-column funnel — bottleneck = highest red×2 + amber weight. */
export function buildTowerFunnelBars(
  columns: TowerColumnCounts[] | undefined,
  factory: TowerFactoryFilter,
): TowerFunnelBar[] {
  const byId = new Map((columns ?? []).map((col) => [col.column_id, col]));
  const bars: TowerFunnelBar[] = TOWER_COLUMN_DEFS.map((def) => {
    const col = byId.get(def.id);
    const redCount = col?.red_count ?? 0;
    const amberCount = col?.amber_count ?? 0;
    const okCount = col?.ok_count ?? 0;
    const unusedLabel = towerColumnUnusedLabel(def.id, factory);
    const headerSeverity = col?.header_severity ?? 'ok';
    return {
      columnId: def.id,
      label: def.label,
      redCount,
      amberCount,
      okCount,
      totalIssues: redCount + amberCount,
      weight: unusedLabel ? 0 : redCount * 2 + amberCount,
      barHeightPct: 0,
      isBottleneck: false,
      unusedLabel,
      degraded: Boolean(col?.degraded),
      headerSeverity,
    };
  });

  const active = bars.filter((bar) => !bar.unusedLabel);
  const maxWeight = Math.max(1, ...active.map((bar) => bar.weight));
  let bottleneckId: TowerUiColumnId | null = null;
  let bottleneckWeight = -1;
  for (const bar of active) {
    if (bar.weight > bottleneckWeight) {
      bottleneckWeight = bar.weight;
      bottleneckId = bar.columnId;
    }
  }

  return bars.map((bar) => ({
    ...bar,
    barHeightPct: bar.unusedLabel ? 0 : bar.weight === 0 ? 12 : Math.round((bar.weight / maxWeight) * 100),
    isBottleneck: bar.columnId === bottleneckId && bar.weight > 0,
  }));
}

export function towerHealthTone(totalIssues: number, redCount: number): 'ok' | 'warn' | 'critical' {
  if (redCount > 0) return 'critical';
  if (totalIssues > 0) return 'warn';
  return 'ok';
}

export function deptHeatPct(row: TowerOrgRollupEntry, maxTotal: number): number {
  const total = row.red_count + row.amber_count;
  if (row.outside_cycle || total === 0) return 0;
  return Math.round((total / Math.max(1, maxTotal)) * 100);
}
