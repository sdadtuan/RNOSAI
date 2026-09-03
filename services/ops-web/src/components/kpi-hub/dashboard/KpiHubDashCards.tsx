'use client';

import { KPI_HUB_DASHBOARD } from '@/lib/kpi-hub-fixtures';
import { KpiHubStatusBadge } from '../KpiHubStatusBadge';

export function KpiHubDashCards() {
  const { cards } = KPI_HUB_DASHBOARD;
  return (
    <div className="kpi-hub-dash-cards">
      {cards.map((card) => (
        <article key={card.code} className="kpi-hub-card kpi-hub-dash-card">
          <header className="kpi-hub-dash-card__head">
            <span className="kpi-hub-dash-card__code">{card.code}</span>
            <KpiHubStatusBadge kind="perf" status={card.status} label={card.badge} />
          </header>
          <p className="kpi-hub-dash-card__name">{card.name}</p>
          <p className="kpi-hub-dash-card__value">{card.formatted}</p>
          {'deltaPct' in card && card.deltaPct != null ? (
            <p className={`kpi-hub-dash-card__delta${card.deltaPct >= 0 ? ' is-up' : ' is-down'}`}>
              {card.deltaPct >= 0 ? '+' : ''}
              {card.deltaPct}% so với kỳ trước
            </p>
          ) : null}
          <div className="kpi-hub-sparkline" aria-hidden>
            <svg viewBox="0 0 80 24" preserveAspectRatio="none">
              <polyline
                points="0,18 12,14 24,16 36,10 48,12 60,6 72,8 80,4"
                fill="none"
                stroke="#10B981"
                strokeWidth="2"
              />
            </svg>
          </div>
        </article>
      ))}
    </div>
  );
}
