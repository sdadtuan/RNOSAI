'use client';

import { KPI_HUB_DICT_SUMMARY } from '@/lib/kpi-hub-fixtures';

export function KpiHubDictSummaryCards() {
  const s = KPI_HUB_DICT_SUMMARY;
  return (
    <div className="kpi-hub-summary-grid">
      <article className="kpi-hub-card kpi-hub-summary-card">
        <p className="kpi-hub-summary-card__label">Tổng KPI</p>
        <p className="kpi-hub-summary-card__value">{s.total}</p>
      </article>
      <article className="kpi-hub-card kpi-hub-summary-card kpi-hub-summary-card--green">
        <p className="kpi-hub-summary-card__label">Đang hoạt động</p>
        <p className="kpi-hub-summary-card__value">{s.active}</p>
      </article>
      <article className="kpi-hub-card kpi-hub-summary-card kpi-hub-summary-card--amber">
        <p className="kpi-hub-summary-card__label">Cần rà soát</p>
        <p className="kpi-hub-summary-card__value">{s.needReview}</p>
      </article>
      <article className="kpi-hub-card kpi-hub-summary-card">
        <p className="kpi-hub-summary-card__label">Nguồn dữ liệu</p>
        <p className="kpi-hub-summary-card__value">{s.sources}</p>
      </article>
    </div>
  );
}
