export const TOWER_EMPTY_STATE_COPY = 'Không sót trong cửa sổ — kiểm tra degraded';
export const TOWER_FACTORY_B_UNUSED_LABEL = 'Không dùng Factory B';

export type TowerFactoryFilter = 'A' | 'B' | 'both';
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
