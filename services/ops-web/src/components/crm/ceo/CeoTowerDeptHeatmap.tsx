'use client';

import {
  deptHeatPct,
  deptRollupSummary,
  departmentRollupEntries,
  type TowerOrgRollupEntry,
} from '@/lib/crm/ceo-tower-ui.util';

export type CeoTowerDeptHeatmapProps = {
  orgRollup: TowerOrgRollupEntry[] | undefined;
  activeDepartment: string;
  onDepartment: (code: string, outsideCycle?: boolean) => void;
};

export function CeoTowerDeptHeatmap({
  orgRollup,
  activeDepartment,
  onDepartment,
}: CeoTowerDeptHeatmapProps) {
  const rows = departmentRollupEntries(orgRollup);
  if (!rows.length) return null;

  const maxTotal = Math.max(
    1,
    ...rows
      .filter((row) => !row.outside_cycle)
      .map((row) => row.red_count + row.amber_count),
  );

  return (
    <div data-testid="ceo-tower-dept-panel" className="ceo-tower-dept" aria-label="Sót theo phòng">
      <h3 className="ceo-tower-dept__title">Theo phòng</h3>
      <div className="kpi-bar-chart__rows">
        {rows.map((row) => {
          const total = row.red_count + row.amber_count;
          const pct = deptHeatPct(row, maxTotal);
          const active = activeDepartment === row.code;
          const redPct = total > 0 ? Math.round((row.red_count / total) * 100) : 0;
          const amberPct = total > 0 ? 100 - redPct : 0;
          return (
            <button
              key={row.code}
              type="button"
              data-testid={`ceo-tower-dept-${row.code}`}
              className={`ceo-tower-dept__row ${active ? 'ceo-tower-dept__row--active' : ''}`}
              onClick={() => onDepartment(row.code, row.outside_cycle)}
            >
              <span className="kpi-bar-chart__label">{row.label_vi}</span>
              <span className="ceo-tower-dept__track" aria-hidden="true">
                {row.outside_cycle ? (
                  <span className="ceo-tower-dept__outside" />
                ) : total === 0 ? (
                  <span className="ceo-tower-dept__empty" />
                ) : (
                  <span className="ceo-tower-dept__stack" style={{ width: `${pct}%` }}>
                    {row.amber_count > 0 ? (
                      <span
                        className="ceo-tower-dept__seg ceo-tower-dept__seg--amber"
                        style={{ flexBasis: `${amberPct}%` }}
                      />
                    ) : null}
                    {row.red_count > 0 ? (
                      <span
                        className="ceo-tower-dept__seg ceo-tower-dept__seg--red"
                        style={{ flexBasis: `${redPct}%` }}
                      />
                    ) : null}
                  </span>
                )}
              </span>
              <span className="kpi-bar-chart__value">{deptRollupSummary(row)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
