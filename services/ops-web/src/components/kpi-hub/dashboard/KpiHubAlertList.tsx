'use client';

import type { KpiHubDashboardData } from '@/lib/kpi-hub-types';
import { KpiHubStatusBadge } from '../KpiHubStatusBadge';

type Props = {
  alerts: KpiHubDashboardData['alerts'];
};

export function KpiHubAlertList({ alerts }: Props) {
  return (
    <article className="kpi-hub-card kpi-hub-alert-list">
      <header className="kpi-hub-card__head">
        <h2>Cảnh báo cần xử lý</h2>
      </header>
      <ul className="kpi-hub-alert-list__items">
        {alerts.map((a, i) => (
          <li key={i} className={`kpi-hub-alert-list__item kpi-hub-alert-list__item--${a.level.toLowerCase()}`}>
            <KpiHubStatusBadge
              kind="perf"
              status={a.level === 'SUCCESS' ? 'ACHIEVED' : a.level === 'INFO' ? 'NO_STATUS' : a.level}
            />
            <div>
              <strong>{a.title}</strong>
              <span className="muted">{a.scope}</span>
              {a.age ? <span className="kpi-hub-alert-list__age">{a.age}</span> : null}
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
