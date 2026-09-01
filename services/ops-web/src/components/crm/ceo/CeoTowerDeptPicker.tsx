'use client';

import {
  departmentRollupEntries,
  deptRollupSummary,
  type TowerOrgRollupEntry,
} from '@/lib/crm/ceo-tower-ui.util';

export type CeoTowerDeptPickerProps = {
  orgRollup: TowerOrgRollupEntry[] | undefined;
  activeDepartment: string;
  onDepartment: (code: string, outsideCycle?: boolean) => void;
};

export function CeoTowerDeptPicker({
  orgRollup,
  activeDepartment,
  onDepartment,
}: CeoTowerDeptPickerProps) {
  const rows = departmentRollupEntries(orgRollup);
  if (!rows.length) return null;

  return (
    <section className="ceo-tower-dept-picker" data-testid="ceo-tower-dept-picker" aria-label="Chọn phòng">
      <div className="ceo-tower-dept-picker__head">
        <h3 className="ceo-tower-dept-picker__title">Chọn phòng để drill</h3>
        <p className="ceo-tower-dept-picker__hint">Bấm phòng có đỏ/vàng → lọc hàng chờ và drill bộ phận bên dưới</p>
      </div>
      <div className="ceo-tower-dept-picker__grid">
        {rows.map((row) => {
          const total = row.red_count + row.amber_count;
          const active = activeDepartment === row.code;
          const tone =
            row.outside_cycle ? 'outside' : row.red_count > 0 ? 'red' : row.amber_count > 0 ? 'amber' : 'ok';

          return (
            <button
              key={row.code}
              type="button"
              data-testid={`ceo-tower-dept-${row.code}`}
              className={`ceo-tower-dept-picker__card ceo-tower-dept-picker__card--${tone}${active ? ' ceo-tower-dept-picker__card--active' : ''}`}
              onClick={() => onDepartment(row.code, row.outside_cycle)}
            >
              <span className="ceo-tower-dept-picker__name">{row.label_vi}</span>
              {row.outside_cycle ? (
                <span className="ceo-tower-dept-picker__meta">Ngoài chu trình</span>
              ) : (
                <span className="ceo-tower-dept-picker__counts">
                  {row.red_count > 0 ? (
                    <span className="ceo-tower-dept-picker__count ceo-tower-dept-picker__count--red">
                      {row.red_count} đỏ
                    </span>
                  ) : null}
                  {row.amber_count > 0 ? (
                    <span className="ceo-tower-dept-picker__count ceo-tower-dept-picker__count--amber">
                      {row.amber_count} vàng
                    </span>
                  ) : null}
                  {total === 0 ? <span className="ceo-tower-dept-picker__count">Ổn</span> : null}
                </span>
              )}
              <span className="ceo-tower-dept-picker__summary">{deptRollupSummary(row)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
