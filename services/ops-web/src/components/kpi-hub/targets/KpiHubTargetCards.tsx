'use client';

import { KPI_HUB_TARGETS } from '@/lib/kpi-hub-fixtures';

export function KpiHubTargetCards() {
  const s = KPI_HUB_TARGETS.summary;
  return (
    <div className="kpi-hub-summary-grid kpi-hub-summary-grid--4">
      <article className="kpi-hub-card kpi-hub-summary-card">
        <p className="kpi-hub-summary-card__label">Đã thiết lập</p>
        <p className="kpi-hub-summary-card__value">
          {s.configured}/{s.total}
        </p>
      </article>
      <article className="kpi-hub-card kpi-hub-summary-card kpi-hub-summary-card--green">
        <p className="kpi-hub-summary-card__label">Đạt target</p>
        <p className="kpi-hub-summary-card__value">{s.achievedPct}%</p>
      </article>
      <article className="kpi-hub-card kpi-hub-summary-card kpi-hub-summary-card--amber">
        <p className="kpi-hub-summary-card__label">Cảnh báo</p>
        <p className="kpi-hub-summary-card__value">{s.warning}</p>
      </article>
      <article className="kpi-hub-card kpi-hub-summary-card kpi-hub-summary-card--red">
        <p className="kpi-hub-summary-card__label">Nguy cấp</p>
        <p className="kpi-hub-summary-card__value">{s.critical}</p>
      </article>
    </div>
  );
}
