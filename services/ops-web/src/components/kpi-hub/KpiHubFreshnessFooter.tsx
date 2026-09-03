'use client';

import { KPI_HUB_FRESHNESS } from '@/lib/kpi-hub-fixtures';

const STATUS_LABEL: Record<string, string> = {
  FRESH: 'Fresh',
  DELAYED: 'Delayed',
  FAILED: 'Failed',
  UNKNOWN: 'Unknown',
};

export function KpiHubFreshnessFooter() {
  const { asOfLabel, sources } = KPI_HUB_FRESHNESS;
  return (
    <footer className="kpi-hub-freshness">
      <span className="kpi-hub-freshness__as-of">Dữ liệu cập nhật: {asOfLabel}</span>
      <div className="kpi-hub-freshness__sources">
        {sources.map((s) => (
          <span
            key={s.system}
            className={`kpi-hub-freshness__chip kpi-hub-freshness__chip--${s.status.toLowerCase()}`}
          >
            {s.label} {STATUS_LABEL[s.status] ?? s.status}
          </span>
        ))}
      </div>
    </footer>
  );
}
