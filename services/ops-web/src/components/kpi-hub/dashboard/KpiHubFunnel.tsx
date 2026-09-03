'use client';

import { KPI_HUB_DASHBOARD } from '@/lib/kpi-hub-fixtures';

export function KpiHubFunnel() {
  const { funnel } = KPI_HUB_DASHBOARD;
  const max = funnel.stages[0]?.value ?? 1;

  return (
    <article className="kpi-hub-card kpi-hub-funnel">
      <header className="kpi-hub-card__head">
        <h2>Funnel chuyển đổi</h2>
      </header>
      <div className="kpi-hub-funnel__stages">
        {funnel.stages.map((stage, i) => {
          const widthPct = Math.max(8, (stage.value / max) * 100);
          return (
            <div key={stage.code} className="kpi-hub-funnel__stage">
              <div className="kpi-hub-funnel__bar-wrap">
                <div className="kpi-hub-funnel__bar" style={{ width: `${widthPct}%` }} />
              </div>
              <div className="kpi-hub-funnel__meta">
                <strong>{stage.name}</strong>
                <span>{stage.value.toLocaleString('vi-VN')}</span>
                {'conversion' in stage && stage.conversion ? (
                  <span className="kpi-hub-funnel__conv">{stage.conversion}</span>
                ) : null}
              </div>
              {i < funnel.stages.length - 1 ? (
                <span className="kpi-hub-funnel__arrow" aria-hidden>
                  →
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <aside className="kpi-hub-funnel__bottleneck">
        <span className="kpi-hub-funnel__bottleneck-label">Điểm nghẽn</span>
        <strong>{funnel.bottleneck.label}</strong>
        <span className="muted">{funnel.bottleneck.code}</span>
      </aside>
    </article>
  );
}
