'use client';

import type { ServiceKpiInstanceItem } from '@/lib/service-kpi-types';

type Props = {
  instances: ServiceKpiInstanceItem[];
  dictionaryLabels?: Record<string, string>;
  highlightId?: string;
};

export function ServiceKpiTrackingPanel({ instances, dictionaryLabels = {}, highlightId }: Props) {
  const withActual = instances.filter((i) => i.latest_actual != null);
  const atRisk = instances.filter((i) => i.status === 'AT_RISK').length;

  return (
    <div className="kpi-hub-skpi-tracking">
      <div className="kpi-hub-skpi-summary kpi-hub-skpi-summary--tiles">
        <span>{instances.length} instances</span>
        <span>{withActual.length} có actual</span>
        <span>{atRisk} at risk</span>
        <span>{instances.length - withActual.length} chưa có actual</span>
      </div>
      {instances.length ? (
        <div className="kpi-hub-skpi-bars">
          {instances.map((inst) => {
            const pct =
              inst.variance_pct != null ? Math.min(100, Math.max(0, 50 + inst.variance_pct / 2)) : 30;
            const label = dictionaryLabels[inst.dictionary_id] ?? inst.dictionary_id;
            return (
              <div
                key={inst.id}
                className={`kpi-hub-skpi-bar${highlightId === inst.id ? ' is-highlight' : ''}`}
              >
                <label>{label}</label>
                <div className="kpi-hub-skpi-bar__track">
                  <div
                    className={`kpi-hub-skpi-bar__fill${inst.status === 'AT_RISK' ? ' is-risk' : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span>
                  {inst.latest_actual ?? 'N/A'} / {inst.target_max ?? '—'}
                  {inst.variance_pct != null ? ` (${inst.variance_pct > 0 ? '+' : ''}${inst.variance_pct}%)` : ''}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="kpi-hub-empty">Chưa có actual — bấm 「+ Nhập Actual」 hoặc ingest qua API.</p>
      )}
    </div>
  );
}
