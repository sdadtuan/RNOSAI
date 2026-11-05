'use client';

import type { KpiHubDictSummary } from '@/lib/kpi-hub-types';

type Props = {
  summary: KpiHubDictSummary;
  loading?: boolean;
};

function SummaryIcon({ kind }: { kind: 'total' | 'active' | 'review' | 'sources' }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 };
  switch (kind) {
    case 'total':
      return (
        <svg {...common}>
          <path d="M3 3v18h18" />
          <path d="M18 17V9" />
          <path d="M13 17V5" />
          <path d="M8 17v-3" />
        </svg>
      );
    case 'active':
      return (
        <svg {...common}>
          <path d="M20 6L9 17l-5-5" />
        </svg>
      );
    case 'review':
      return (
        <svg {...common}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
        </svg>
      );
  }
}

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

  const cards = [
    { key: 'total' as const, label: 'Tổng KPI', value: summary.total, tone: '' },
    { key: 'active' as const, label: 'Đang hoạt động', value: summary.active, tone: 'green' },
    { key: 'review' as const, label: 'Cần rà soát', value: summary.needReview, tone: 'amber' },
    { key: 'sources' as const, label: 'Nguồn dữ liệu', value: summary.sources, tone: '' },
  ];

  return (
    <div className="kpi-hub-summary-grid">
      {cards.map((card) => (
        <article
          key={card.key}
          className={`kpi-hub-card kpi-hub-summary-card kpi-hub-summary-card--with-icon${
            card.tone ? ` kpi-hub-summary-card--${card.tone}` : ''
          }`}
        >
          <div className="kpi-hub-summary-card__top">
            <p className="kpi-hub-summary-card__label">{card.label}</p>
            <span className={`kpi-hub-summary-card__icon kpi-hub-summary-card__icon--${card.key}`} aria-hidden>
              <SummaryIcon kind={card.key} />
            </span>
          </div>
          <p className="kpi-hub-summary-card__value">{card.value}</p>
        </article>
      ))}
    </div>
  );
}
