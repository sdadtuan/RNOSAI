'use client';

import { KPI_HUB_DASHBOARD } from '@/lib/kpi-hub-fixtures';

function fmtRevenue(v: number) {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)} tỷ`;
  if (v >= 1_000_000) return `${Math.round(v / 1_000_000)} tr`;
  return v.toLocaleString('vi-VN');
}

export function KpiHubChannelChart() {
  const { channels } = KPI_HUB_DASHBOARD;
  const maxLeads = Math.max(...channels.map((c) => c.validLeads));

  return (
    <article className="kpi-hub-card kpi-hub-channel-chart">
      <header className="kpi-hub-card__head">
        <h2>Valid Leads & Doanh thu theo kênh</h2>
      </header>
      <div className="kpi-hub-channel-chart__list">
        {channels.map((ch) => (
          <div key={ch.channel} className="kpi-hub-channel-chart__row">
            <span className="kpi-hub-channel-chart__label">{ch.channel}</span>
            <div className="kpi-hub-channel-chart__bars">
              <div className="kpi-hub-channel-chart__bar-group">
                <span className="muted">Leads</span>
                <div className="kpi-hub-bar-track">
                  <div
                    className="kpi-hub-bar-fill kpi-hub-bar-fill--blue"
                    style={{ width: `${(ch.validLeads / maxLeads) * 100}%` }}
                  />
                </div>
                <span>{ch.validLeads.toLocaleString('vi-VN')}</span>
              </div>
              <div className="kpi-hub-channel-chart__bar-group">
                <span className="muted">Doanh thu</span>
                <div className="kpi-hub-bar-track">
                  <div
                    className="kpi-hub-bar-fill kpi-hub-bar-fill--green"
                    style={{ width: `${(ch.revenue / 420000000) * 100}%` }}
                  />
                </div>
                <span>{fmtRevenue(ch.revenue)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
