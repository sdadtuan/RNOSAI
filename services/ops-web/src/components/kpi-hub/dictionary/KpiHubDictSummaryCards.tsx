'use client';

import type { KpiHubDictSummary } from '@/lib/kpi-hub-types';

type Props = {
  summary: KpiHubDictSummary;
  loading?: boolean;
};

export function KpiHubDictSummaryCards({ summary, loading }: Props) {
  if (loading) {
    return (
      <div className="kpi-hub-summary-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <article key={i} className="kpi-hub-card kpi-hub-summary-card kpi-hub-skeleton-card">
            <div className="kpi-hub-skeleton kpi-hub-skeleton--line kpi-hub-skeleton--sm" />
            <div className="kpi-hub-skeleton kpi-hub-skeleton--line kpi-hub-skeleton--lg" />
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className="kpi-hub-summary-grid">
      <article className="kpi-hub-card kpi-hub-summary-card">
        <p className="kpi-hub-summary-card__label">Tổng KPI</p>
        <p className="kpi-hub-summary-card__value">{summary.total}</p>
      </article>
      <article className="kpi-hub-card kpi-hub-summary-card kpi-hub-summary-card--green">
        <p className="kpi-hub-summary-card__label">Đang hoạt động</p>
        <p className="kpi-hub-summary-card__value">{summary.active}</p>
      </article>
      <article className="kpi-hub-card kpi-hub-summary-card kpi-hub-summary-card--amber">
        <p className="kpi-hub-summary-card__label">Cần rà soát</p>
        <p className="kpi-hub-summary-card__value">{summary.needReview}</p>
      </article>
      <article className="kpi-hub-card kpi-hub-summary-card">
        <p className="kpi-hub-summary-card__label">Nguồn dữ liệu</p>
        <p className="kpi-hub-summary-card__value">{summary.sources}</p>
      </article>
    </div>
  );
}
