'use client';

import { useMemo } from 'react';
import { departmentRollupEntries, type TowerOrgRollupEntry } from '@/lib/crm/ceo-tower-ui.util';

export type CeoTowerDeptPickerProps = {
  orgRollup: TowerOrgRollupEntry[] | undefined;
  activeDepartment: string;
  onDepartment: (code: string, outsideCycle?: boolean) => void;
};

function sortDepts(rows: TowerOrgRollupEntry[]): TowerOrgRollupEntry[] {
  return [...rows].sort(
    (a, b) =>
      Number(Boolean(a.outside_cycle)) - Number(Boolean(b.outside_cycle)) ||
      b.red_count - a.red_count ||
      b.amber_count - a.amber_count ||
      a.label_vi.localeCompare(b.label_vi, 'vi'),
  );
}

function sharePct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

export function CeoTowerDeptPicker({
  orgRollup,
  activeDepartment,
  onDepartment,
}: CeoTowerDeptPickerProps) {
  const rows = useMemo(() => sortDepts(departmentRollupEntries(orgRollup)), [orgRollup]);
  const cycleTotal = rows
    .filter((row) => !row.outside_cycle)
    .reduce((sum, row) => sum + row.red_count + row.amber_count, 0);
  const companyRed = rows.reduce((sum, row) => sum + row.red_count, 0);
  const companyAmber = rows.reduce((sum, row) => sum + row.amber_count, 0);

  if (!rows.length) return null;

  return (
    <section className="ceo-tower-dept-board" data-testid="ceo-tower-dept-picker" aria-label="Theo phòng">
      <header className="ceo-tower-dept-board__head">
        <h3 className="ceo-tower-dept-board__title">Theo phòng</h3>
        <p className="ceo-tower-dept-board__hint">Chọn phòng — hàng chờ cập nhật bên cạnh</p>
      </header>
      <div className="data-table-wrap ceo-tower-dept-board__table-wrap">
        <table className="data-table ceo-tower-dept-board__table">
          <thead>
            <tr>
              <th>Phòng</th>
              <th className="ceo-tower-dept-board__num">Đỏ</th>
              <th className="ceo-tower-dept-board__num">Vàng</th>
              <th>Tỷ trọng</th>
            </tr>
          </thead>
          <tbody>
            <tr
              className={!activeDepartment ? 'ceo-tower-dept-board__row--active' : undefined}
              onClick={() => onDepartment('')}
            >
              <td>
                <button
                  type="button"
                  data-testid="ceo-tower-dept-ALL"
                  className="ceo-tower-dept-board__name"
                  onClick={() => onDepartment('')}
                >
                  Tất cả
                </button>
              </td>
              <td className="ceo-tower-dept-board__num ceo-tower-dept-board__num--red">{companyRed}</td>
              <td className="ceo-tower-dept-board__num ceo-tower-dept-board__num--amber">{companyAmber}</td>
              <td>
                <ShareBar red={companyRed} amber={companyAmber} pct={cycleTotal > 0 ? 100 : 0} />
              </td>
            </tr>
            {rows.map((row) => {
              const total = row.red_count + row.amber_count;
              const pct = row.outside_cycle ? 0 : sharePct(total, cycleTotal);
              const active = activeDepartment === row.code;
              return (
                <tr
                  key={row.code}
                  className={[
                    active ? 'ceo-tower-dept-board__row--active' : '',
                    row.outside_cycle ? 'ceo-tower-dept-board__row--outside' : '',
                    row.red_count > 0 ? 'ceo-tower-dept-board__row--hot' : '',
                  ]
                    .filter(Boolean)
                    .join(' ') || undefined}
                  onClick={() => onDepartment(row.code, row.outside_cycle)}
                >
                  <td>
                    <button
                      type="button"
                      data-testid={`ceo-tower-dept-${row.code}`}
                      className="ceo-tower-dept-board__name"
                      onClick={() => onDepartment(row.code, row.outside_cycle)}
                    >
                      {row.label_vi}
                      {row.outside_cycle ? (
                        <span className="ceo-tower-dept-board__tag">Ngoài chu trình</span>
                      ) : null}
                    </button>
                  </td>
                  <td className="ceo-tower-dept-board__num ceo-tower-dept-board__num--red">
                    {row.outside_cycle ? '—' : row.red_count}
                  </td>
                  <td className="ceo-tower-dept-board__num ceo-tower-dept-board__num--amber">
                    {row.outside_cycle ? '—' : row.amber_count}
                  </td>
                  <td>
                    {row.outside_cycle ? (
                      <span className="muted">—</span>
                    ) : (
                      <ShareBar red={row.red_count} amber={row.amber_count} pct={pct} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ShareBar({ red, amber, pct }: { red: number; amber: number; pct: number }) {
  const total = red + amber;
  const redShare = total > 0 ? (red / total) * pct : 0;
  const amberShare = total > 0 ? (amber / total) * pct : 0;
  return (
    <div className="ceo-tower-dept-board__share">
      <div className="ceo-tower-dept-board__bar" aria-hidden="true">
        <span className="ceo-tower-dept-board__bar-seg ceo-tower-dept-board__bar-seg--red" style={{ width: `${redShare}%` }} />
        <span className="ceo-tower-dept-board__bar-seg ceo-tower-dept-board__bar-seg--amber" style={{ width: `${amberShare}%` }} />
      </div>
      <span className="ceo-tower-dept-board__pct">{pct}%</span>
    </div>
  );
}
