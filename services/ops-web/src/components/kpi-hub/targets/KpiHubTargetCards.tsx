'use client';

import type { KpiHubTargetsData } from '@/lib/kpi-hub-types';

type Props = {
  summary: KpiHubTargetsData['summary'];
  loading?: boolean;
};

export function KpiHubTargetCards({ summary, loading }: Props) {
  if (loading) {
    return (
      <div className="kpi-hub-summary-grid kpi-hub-summary-grid--4">
        {Array.from({ length: 4 }).map((_, i) => (
          <article key={i} className="kpi-hub-card kpi-hub-summary-card kpi-hub-skeleton-card">
            <div className="kpi-hub-skeleton kpi-hub-skeleton--line kpi-hub-skeleton--sm" />
            <div className="kpi-hub-skeleton kpi-hub-skeleton--line kpi-hub-skeleton--lg" />
          </article>
        ))}
      </div>
    );
  }

  const s = summary;
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
