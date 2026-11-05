'use client';

import type { KpiHubDashboardCard } from '@/lib/kpi-hub-types';
import { KpiHubStatusBadge } from '../KpiHubStatusBadge';

type Props = {
  cards: KpiHubDashboardCard[];
  loading?: boolean;
  onSelect?: (card: KpiHubDashboardCard) => void;
};

function DashCardSkeleton() {
  return (
    <article className="kpi-hub-card kpi-hub-dash-card kpi-hub-skeleton-card">
      <div className="kpi-hub-skeleton kpi-hub-skeleton--line kpi-hub-skeleton--sm" />
      <div className="kpi-hub-skeleton kpi-hub-skeleton--line" />
      <div className="kpi-hub-skeleton kpi-hub-skeleton--line kpi-hub-skeleton--lg" />
    </article>
  );
}

export function KpiHubDashCards({ cards, loading, onSelect }: Props) {
  if (loading) {
    return (
      <div className="kpi-hub-dash-cards">
        {Array.from({ length: 5 }).map((_, i) => (
          <DashCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="kpi-hub-dash-cards">
      {cards.map((card) => (
        <article
          key={card.code}
          className="kpi-hub-card kpi-hub-dash-card kpi-hub-dash-card--clickable"
          onClick={() => onSelect?.(card)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect?.(card);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <header className="kpi-hub-dash-card__head">
            <span className="kpi-hub-dash-card__code">{card.code}</span>
            <KpiHubStatusBadge kind="perf" status={card.status} label={card.badge} />
          </header>
          <p className="kpi-hub-dash-card__name">{card.name}</p>
          <p className="kpi-hub-dash-card__value">{card.formatted}</p>
          {card.deltaPct != null ? (
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
