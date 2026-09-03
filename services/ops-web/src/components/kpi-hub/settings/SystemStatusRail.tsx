'use client';

import { KpiHubStatusBadge } from '../KpiHubStatusBadge';

const SYSTEMS = [
  { name: 'CRM', status: 'CONNECTED' },
  { name: 'Meta Ads', status: 'CONNECTED' },
  { name: 'GA4', status: 'UNAVAILABLE' },
  { name: 'SharePoint', status: 'DELAYED' },
  { name: 'ERP', status: 'CONNECTED' },
];

export function SystemStatusRail() {
  return (
    <section className="kpi-hub-card">
      <h3>Tình trạng hệ thống</h3>
      <ul className="kpi-hub-system-list">
        {SYSTEMS.map((s) => (
          <li key={s.name}>
            <span>{s.name}</span>
            <KpiHubStatusBadge kind="source" status={s.status} />
          </li>
        ))}
      </ul>
    </section>
  );
}
