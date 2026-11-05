'use client';

import { MOAT_WAR_ROOM } from '@/lib/service-kpi-copy';
import { SkpiMoatNotice } from './SkpiMoatNotice';

type Row = { dv_code: string; kpi_health_pct: number; gm_pct: number | null };

type Props = {
  rows: Row[];
};

function healthTone(pct: number): string {
  if (pct < 75) return 'kpi-hub-skpi-dv-health__value--warn';
  return 'kpi-hub-skpi-dv-health__value--ok';
}

export function SkpiDvHealthList({ rows }: Props) {
  return (
    <article className="kpi-hub-card">
      <header className="kpi-hub-card__head kpi-hub-skpi-section-head">
        <h2>DV lệch KPI và margin</h2>
        <span className="kpi-hub-muted">internal</span>
      </header>
      <div className="kpi-hub-card__body">
        {rows.length ? (
          <ul className="kpi-hub-skpi-dv-health">
            {rows.map((row) => (
              <li key={row.dv_code} className="kpi-hub-skpi-dv-health__row">
                <span>{row.dv_code}</span>
                <b className={healthTone(row.kpi_health_pct)}>
                  {row.kpi_health_pct}% KPI
                  {row.gm_pct != null ? ` · GM ${row.gm_pct}%` : ''}
                </b>
              </li>
            ))}
          </ul>
        ) : (
          <p className="kpi-hub-muted">Chưa có instance theo DV</p>
        )}
        <SkpiMoatNotice>{MOAT_WAR_ROOM}</SkpiMoatNotice>
      </div>
    </article>
  );
}
