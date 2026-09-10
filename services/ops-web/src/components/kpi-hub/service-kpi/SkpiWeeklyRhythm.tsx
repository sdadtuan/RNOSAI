'use client';

import type { ServiceKpiWarRoomData } from '@/lib/service-kpi-types';

type Props = {
  data: Pick<
    ServiceKpiWarRoomData,
    'assumptions_open' | 'critical_overdue' | 'blocked_reports' | 'quotes_score_gte_70' | 'dv_health'
  >;
};

export function SkpiWeeklyRhythm({ data }: Props) {
  const worstDv = data.dv_health.length
    ? [...data.dv_health].sort((a, b) => a.kpi_health_pct - b.kpi_health_pct)[0]?.dv_code
    : '—';

  return (
    <article className="kpi-hub-card kpi-hub-skpi-readiness">
      <header className="kpi-hub-card__head">
        <h2>Nhịp tuần bắt buộc</h2>
      </header>
      <div className="kpi-hub-card__body">
        <ul className="kpi-hub-skpi-rhythm-list">
          <li>
            <span>1. Assumption</span>
            <b className={data.assumptions_open ? 'is-warn' : 'is-ok'}>{data.assumptions_open} mở</b>
          </li>
          <li>
            <span>2. Alert quá hạn</span>
            <b className={data.critical_overdue ? 'is-critical' : 'is-ok'}>{data.critical_overdue}</b>
          </li>
          <li>
            <span>3. Data stale</span>
            <b className={data.blocked_reports ? 'is-warn' : 'is-ok'}>
              {data.blocked_reports ? `${String(data.blocked_reports).padStart(2, '0')} chặn report` : '0'}
            </b>
          </li>
          <li>
            <span>4. KPI + GM</span>
            <b>{worstDv}</b>
          </li>
          <li>
            <span>5. Quote score ≥70</span>
            <b className={data.quotes_score_gte_70 ? 'is-warn' : ''}>{data.quotes_score_gte_70}</b>
          </li>
        </ul>
      </div>
    </article>
  );
}
