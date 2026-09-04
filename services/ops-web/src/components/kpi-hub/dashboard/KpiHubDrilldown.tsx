'use client';

import type { KpiHubDashboardCard } from '@/lib/kpi-hub-types';
import { KpiHubStatusBadge } from '../KpiHubStatusBadge';

type Props = {
  card: KpiHubDashboardCard | null;
  onClose: () => void;
};

export function KpiHubDrilldown({ card, onClose }: Props) {
  if (!card) return null;

  return (
    <aside className="kpi-hub-drawer kpi-hub-drilldown" aria-label="Chi tiết KPI">
      <header className="kpi-hub-drawer__head">
        <div>
          <h2>{card.name}</h2>
          <span className="kpi-hub-table__mono">{card.code}</span>
        </div>
        <button type="button" className="kpi-hub-drawer__close" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="kpi-hub-drawer__body">
        <div className="kpi-hub-drilldown__value-row">
          <strong className="kpi-hub-drilldown__value">{card.formatted}</strong>
          <KpiHubStatusBadge kind="perf" status={card.status} label={card.badge} />
        </div>
        <section className="kpi-hub-drawer__section">
          <h3>Định nghĩa</h3>
          <p>{card.formulaDisplay ?? 'Chưa có mô tả công thức nghiệp vụ.'}</p>
        </section>
        <section className="kpi-hub-drawer__section">
          <h3>Trạng thái nguồn</h3>
          {card.sourceStatus ? (
            <KpiHubStatusBadge kind="source" status={card.sourceStatus} />
          ) : (
            <KpiHubStatusBadge kind="source" status="CONNECTED" />
          )}
        </section>
        <section className="kpi-hub-drawer__section">
          <h3>Phân rã</h3>
          {card.breakdown?.length ? (
            <dl className="kpi-hub-drawer__dl">
              {card.breakdown.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>
                    {row.value}
                    {row.pct != null ? ` (${row.pct}%)` : ''}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="muted">Chưa có dữ liệu phân rã cho KPI này.</p>
          )}
        </section>
      </div>
    </aside>
  );
}
