'use client';

import {
  activeOrgLensLevel,
  deptRollupSummary,
  orgLensLevelLabel,
  orgRollupByLevel,
  type TowerOrgRollupEntry,
} from '@/lib/crm/ceo-tower-ui.util';

export type CeoTowerOrgLensProps = {
  orgRollup: TowerOrgRollupEntry[] | undefined;
  department: string;
  team: string;
  positionCode: string;
  staffId: string;
  onSelect: (level: TowerOrgRollupEntry['level'], code: string) => void;
};

export function CeoTowerOrgLens({
  orgRollup,
  department,
  team,
  positionCode,
  staffId,
  onSelect,
}: CeoTowerOrgLensProps) {
  const lensLevel = activeOrgLensLevel({
    department: department || undefined,
    team: team || undefined,
    position_code: positionCode || undefined,
    staff_id: staffId || undefined,
  });
  if (!lensLevel) return null;

  const rows = orgRollupByLevel(orgRollup, lensLevel).filter((row) => {
    if (lensLevel !== 'department') return row.red_count + row.amber_count > 0;
    return true;
  });
  if (!rows.length) return null;

  const activeCode =
    lensLevel === 'department'
      ? department
      : lensLevel === 'team'
        ? team
        : lensLevel === 'position'
          ? positionCode
          : staffId;

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
              {row.outside_cycle ? (
                <span className="ceo-tower-org-lens__chip-meta">ngoài CT</span>
              ) : total > 0 ? (
                <span className="ceo-tower-org-lens__chip-meta">{deptRollupSummary(row)}</span>
              ) : (
                <span className="ceo-tower-org-lens__chip-meta">0</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
