'use client';

import { KPI_HUB_DASHBOARD } from '@/lib/kpi-hub-fixtures';

export function KpiHubTopSales() {
  const { topSales } = KPI_HUB_DASHBOARD;

  return (
    <article className="kpi-hub-card kpi-hub-top-sales">
      <header className="kpi-hub-card__head">
        <h2>Top Sales</h2>
      </header>
      <ol className="kpi-hub-top-sales__list">
        {topSales.map((s) => (
          <li key={s.rank} className="kpi-hub-top-sales__row">
            <span className="kpi-hub-top-sales__rank">#{s.rank}</span>
            <div className="kpi-hub-top-sales__info">
              <strong>{s.name}</strong>
              <span className="muted">Win Rate {s.winRate}%</span>
            </div>
            <span className="kpi-hub-top-sales__revenue">
              {(s.revenue / 1_000_000).toFixed(0)} triệu
            </span>
          </li>
        ))}
      </ol>
    </article>
  );
}
