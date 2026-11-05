'use client';

import {
  buildDeptRedDonutSegments,
  deptRedDonutConicGradient,
  type TowerOrgRollupEntry,
} from '@/lib/crm/ceo-tower-ui.util';

export type CeoTowerDeptDonutProps = {
  orgRollup: TowerOrgRollupEntry[] | undefined;
  activeDepartment: string;
  onDepartment: (code: string, outsideCycle?: boolean) => void;
};

export function CeoTowerDeptDonut({
  orgRollup,
  activeDepartment,
  onDepartment,
}: CeoTowerDeptDonutProps) {
  const segments = buildDeptRedDonutSegments(orgRollup);
  const gradient = deptRedDonutConicGradient(segments);
  const totalRed = segments.reduce((sum, seg) => sum + seg.value, 0);

  return (
    <div className="ceo-tower-donut" data-testid="ceo-tower-dept-donut" aria-label="Phân bổ đỏ theo phòng">
      <h3 className="ceo-tower-donut__title">Đỏ theo phòng</h3>
      {!gradient ? (
        <p className="muted ceo-tower-donut__empty">Không có sót đỏ trong chu trình</p>
      ) : (
        <div className="ceo-tower-donut__body">
          <div
            className="ceo-tower-donut__ring"
            style={{ background: gradient }}
            aria-hidden="true"
          >
            <div className="ceo-tower-donut__hole">
              <strong>{totalRed}</strong>
              <span>đỏ</span>
            </div>
          </div>
          <ul className="ceo-tower-donut__legend">
            {segments.map((seg) => (
              <li key={seg.code}>
                <button
                  type="button"
                  data-testid={`ceo-tower-donut-${seg.code}`}
                  className={`ceo-tower-donut__legend-btn ${
                    activeDepartment === seg.code ? 'ceo-tower-donut__legend-btn--active' : ''
                  }`}
                  onClick={() => onDepartment(seg.code, false)}
                >
                  <span className="ceo-tower-donut__swatch" style={{ background: seg.color }} />
                  <span className="ceo-tower-donut__legend-label">{seg.label}</span>
                  <span className="ceo-tower-donut__legend-value">
                    {seg.value} · {seg.pct}%
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
