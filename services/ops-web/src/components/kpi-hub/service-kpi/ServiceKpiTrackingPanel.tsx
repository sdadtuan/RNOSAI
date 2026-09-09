'use client';

import type { ServiceKpiInstanceItem } from '@/lib/service-kpi-types';

type Props = {
  instances: ServiceKpiInstanceItem[];
};

export function ServiceKpiTrackingPanel({ instances }: Props) {
  const withActual = instances.filter((i) => i.latest_actual != null);
  return (
    <div className="kpi-hub-skpi-tracking">
      <div className="kpi-hub-skpi-summary">
        <span>{instances.length} instances</span>
        <span>{withActual.length} có actual</span>
      </div>
      {instances.length ? (
        <div className="kpi-hub-skpi-bars">
          {instances.map((inst) => {
            const pct = inst.variance_pct != null ? Math.min(100, Math.max(0, 50 + inst.variance_pct / 2)) : 30;
            return (
              <div key={inst.id} className="kpi-hub-skpi-bar">
                <label>{inst.dictionary_id}</label>
                <div className="kpi-hub-skpi-bar__track">
                  <div className="kpi-hub-skpi-bar__fill" style={{ width: `${pct}%` }} />
                </div>
                <span>{inst.latest_actual ?? 'N/A'} / {inst.target_max ?? '—'}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="kpi-hub-empty">Chưa có actual — ingest qua API hoặc import.</p>
      )}
    </div>
  );
}
