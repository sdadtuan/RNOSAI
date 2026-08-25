import type { LeadSignalKpi } from '@/lib/crm/lead-signal-kpis';

export function LeadSignalKpiStrip({ items }: { items: LeadSignalKpi[] }) {
  return (
    <div className="lead-signal-kpis" data-testid="lead-signal-kpis">
      {items.map((item) => (
        <div key={item.key} className={`lead-signal-kpi lead-signal-kpi--${item.key}`}>
          <b>{item.count}</b>
          <span>{item.label}</span>
        </div>
      ))}
      <p className="lead-signal-kpis__caption">Trong trang này</p>
    </div>
  );
}
