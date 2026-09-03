'use client';

import { KPI_HUB_DASHBOARD } from '@/lib/kpi-hub-fixtures';

export function KpiHubTargetDonut() {
  const { targetProgress } = KPI_HUB_DASHBOARD;
  const pct = targetProgress.overallPct;
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <article className="kpi-hub-card kpi-hub-donut">
      <header className="kpi-hub-card__head">
        <h2>Tiến độ Target</h2>
      </header>
      <div className="kpi-hub-donut__body">
        <div className="kpi-hub-donut__chart">
          <svg viewBox="0 0 100 100" aria-label={`${pct}% tổng thể`}>
            <circle cx="50" cy="50" r="42" fill="none" stroke="#E5E7EB" strokeWidth="10" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="#10B981"
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 50 50)"
              strokeLinecap="round"
            />
            <text x="50" y="48" textAnchor="middle" className="kpi-hub-donut__pct">
              {pct}%
            </text>
            <text x="50" y="62" textAnchor="middle" className="kpi-hub-donut__sub">
              Tổng thể
            </text>
          </svg>
        </div>
        <ul className="kpi-hub-donut__groups">
          {targetProgress.groups.map((g) => (
            <li key={g.code}>
              <span>{g.label}</span>
              <div className="kpi-hub-bar-track">
                <div className="kpi-hub-bar-fill" style={{ width: `${g.pct}%` }} />
              </div>
              <span className="kpi-hub-donut__group-pct">{g.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
