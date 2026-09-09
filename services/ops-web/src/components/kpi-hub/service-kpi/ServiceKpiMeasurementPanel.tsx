'use client';

import type { ServiceKpiInstanceItem } from '@/lib/service-kpi-types';

type Props = {
  instances: ServiceKpiInstanceItem[];
};

export function ServiceKpiMeasurementPanel({ instances }: Props) {
  if (!instances.length) {
    return <p className="kpi-hub-empty">Chọn quote line có KPI instance để lập measurement plan.</p>;
  }
  return (
    <div className="kpi-hub-skpi-measurement">
      {instances.map((inst) => (
        <article key={inst.id} className="kpi-hub-card">
          <header className="kpi-hub-card__head">
            <h3>{inst.dictionary_id}</h3>
            <span className="kpi-hub-badge kpi-hub-badge--gray">{inst.dv_code}</span>
          </header>
          <div className="kpi-hub-card__body">
            <p>Owner: {inst.owner_name ?? '—'}</p>
            <p>Readiness: {inst.readiness_level ?? '—'}</p>
            <p className="kpi-hub-notice">Mapping trống → warning (AC-SKPI-03). Cấu hình qua API measurement-plan.</p>
          </div>
        </article>
      ))}
    </div>
  );
}
