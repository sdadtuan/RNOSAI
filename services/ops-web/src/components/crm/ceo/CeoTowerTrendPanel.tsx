'use client';

import { KpiSparkline } from '@/components/kpi/KpiDashboardUi';
import type { TowerTrendPayload } from '@/lib/crm/ceo-tower-api';
import { formatTowerWowDelta } from '@/lib/crm/ceo-tower-ui.util';

export type CeoTowerTrendPanelProps = {
  trends: TowerTrendPayload | undefined;
};

export function CeoTowerTrendPanel({ trends }: CeoTowerTrendPanelProps) {
  if (!trends?.series.total_issues.length) return null;

  const { series, wow } = trends;
  const wowText = formatTowerWowDelta(wow);

  return (
    <section className="ceo-tower-trends" data-testid="ceo-tower-trends" aria-label="Xu hướng sót 7 ngày">
      <div className="ceo-tower-trends__head">
        <div>
          <h3 className="ceo-tower-trends__title">Xu hướng 7 ngày</h3>
          <p className="muted text-sm">Tổng sót mở cuối mỗi ngày · so với 7 ngày trước</p>
        </div>
        <div
          className={`ceo-tower-trends__wow ceo-tower-trends__wow--${wow.direction}`}
          data-testid="ceo-tower-wow"
        >
          <span className="ceo-tower-trends__wow-value">{wowText}</span>
          <span className="ceo-tower-trends__wow-label">Tuần này</span>
        </div>
      </div>
      <div className="ceo-tower-trends__charts">
        <div className="ceo-tower-trends__chart-card">
          <p className="ceo-tower-trends__chart-label">Tổng sót</p>
          <KpiSparkline
            data={series.total_issues}
            width={280}
            height={56}
            label="Tổng sót 7 ngày"
            className="ceo-tower-trends__sparkline"
          />
          <div className="ceo-tower-trends__axis" aria-hidden="true">
            {series.labels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>
        <div className="ceo-tower-trends__chart-card">
          <p className="ceo-tower-trends__chart-label">Đỏ</p>
          <KpiSparkline
            data={series.red_issues}
            width={280}
            height={56}
            label="Sót đỏ 7 ngày"
            className="ceo-tower-trends__sparkline ceo-tower-trends__sparkline--red"
          />
          <div className="ceo-tower-trends__axis" aria-hidden="true">
            {series.labels.map((label) => (
              <span key={`red-${label}`}>{label}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
