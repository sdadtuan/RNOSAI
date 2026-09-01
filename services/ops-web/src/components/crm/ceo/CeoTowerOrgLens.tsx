'use client';

import {
  activeOrgLensLevel,
  deptRollupSummary,
  orgLensLevelLabel,
  orgRollupByLevel,
  type TowerOrgRollupEntry,
} from '@/lib/crm/ceo-tower-ui.util';
import {
  buildLensEntriesFromExceptions,
  type TowerDrillFilters,
} from '@/lib/crm/ceo-tower-filter.util';
import type { TowerException } from '@/lib/crm/ceo-tower-api';

export type CeoTowerOrgLensProps = {
  orgRollup: TowerOrgRollupEntry[] | undefined;
  scopeExceptions: TowerException[];
  drill: TowerDrillFilters;
  onSelect: (level: TowerOrgRollupEntry['level'], code: string) => void;
};

export function CeoTowerOrgLens({
  orgRollup,
  scopeExceptions,
  drill,
  onSelect,
}: CeoTowerOrgLensProps) {
  const lensLevel = activeOrgLensLevel({
    department: drill.department,
    team: drill.team,
    position_code: drill.position_code,
    staff_id: drill.staff_id,
  });
  if (!lensLevel || lensLevel === 'department') return null;

  const fromRollup = orgRollupByLevel(orgRollup, lensLevel).filter(
    (row) => row.red_count + row.amber_count > 0,
  );

  const fromExceptions =
    lensLevel === 'team' || lensLevel === 'position' || lensLevel === 'staff'
      ? buildLensEntriesFromExceptions(scopeExceptions, lensLevel)
      : [];

  const merged = new Map<string, TowerOrgRollupEntry>();
  for (const row of [...fromRollup, ...fromExceptions]) {
    const prev = merged.get(row.code);
    if (!prev || row.red_count + row.amber_count > prev.red_count + prev.amber_count) {
      merged.set(row.code, row);
    }
  }
  const rows = [...merged.values()].sort(
    (a, b) => b.red_count - a.red_count || b.amber_count - a.amber_count || a.label_vi.localeCompare(b.label_vi, 'vi'),
  );

  if (!rows.length) {
    return (
      <div className="ceo-tower-org-lens ceo-tower-org-lens--empty" data-testid={`ceo-tower-org-lens-${lensLevel}`}>
        <span className="ceo-tower-org-lens__label">{orgLensLevelLabel(lensLevel)}</span>
        <p className="ceo-tower-org-lens__empty">
          Chưa có {orgLensLevelLabel(lensLevel).toLowerCase()} gắn trên các việc sót — xem hàng chờ bên dưới.
        </p>
      </div>
    );
  }

  const activeCode =
    lensLevel === 'team'
      ? drill.team ?? ''
      : lensLevel === 'position'
        ? drill.position_code ?? ''
        : drill.staff_id ?? '';

  return (
    <div className="ceo-tower-org-lens" data-testid={`ceo-tower-org-lens-${lensLevel}`}>
      <span className="ceo-tower-org-lens__label">{orgLensLevelLabel(lensLevel)}</span>
      <div className="ceo-tower-org-lens__chips">
        {rows.map((row) => {
          const active = activeCode === row.code;
          const total = row.red_count + row.amber_count;
          return (
            <button
              key={row.code}
              type="button"
              data-testid={`ceo-tower-lens-${lensLevel}-${row.code}`}
              className={`ceo-tower-org-lens__chip ${active ? 'ceo-tower-org-lens__chip--active' : ''}`}
              onClick={() => onSelect(lensLevel, row.code)}
            >
              <span className="ceo-tower-org-lens__chip-label">{row.label_vi}</span>
              <span className="ceo-tower-org-lens__chip-meta">{deptRollupSummary(row) || (total > 0 ? `${total}` : '0')}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
