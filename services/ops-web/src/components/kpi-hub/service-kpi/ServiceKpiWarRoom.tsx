'use client';

import { WAR_ROOM_TILE_LABELS } from '@/lib/service-kpi-copy';
import type { ServiceKpiWarRoomData } from '@/lib/service-kpi-types';
import { SkpiDvHealthList } from './SkpiDvHealthList';
import { SkpiQueueRow } from './SkpiQueueRow';
import { SkpiTwoColumnLayout } from './SkpiTwoColumnLayout';
import { SkpiWeeklyRhythm } from './SkpiWeeklyRhythm';

type Props = {
  data: ServiceKpiWarRoomData;
  loading?: boolean;
  error?: string | null;
};

export function ServiceKpiWarRoom({ data, loading, error }: Props) {
  if (loading) return <p className="kpi-hub-muted">Đang tải War Room…</p>;
  if (error) return <p className="kpi-hub-form-error">{error}</p>;

  return (
    <div className="kpi-hub-skpi-warroom">
      <div className="kpi-hub-skpi-kpis">
        <article className="kpi-hub-skpi-kpi kpi-hub-skpi-kpi--critical kpi-hub-skpi-kpi--tint-critical">
          <label>{WAR_ROOM_TILE_LABELS.critical}</label>
          <b>{String(data.critical_overdue).padStart(2, '0')}</b>
          <span className="kpi-hub-skpi-kpi__hint--critical">KPI vượt ngưỡng · overdue</span>
        </article>
        <article className="kpi-hub-skpi-kpi kpi-hub-skpi-kpi--warn kpi-hub-skpi-kpi--tint-warn">
          <label>{WAR_ROOM_TILE_LABELS.assumptions}</label>
          <b>{String(data.assumptions_open).padStart(2, '0')}</b>
          <span className="kpi-hub-skpi-kpi__hint--warn">Budget / LP / Sales SLA / Creative</span>
        </article>
        <article className="kpi-hub-skpi-kpi kpi-hub-skpi-kpi--warn kpi-hub-skpi-kpi--tint-warn">
          <label>{WAR_ROOM_TILE_LABELS.blockedReports}</label>
          <b>{String(data.blocked_reports).padStart(2, '0')}</b>
          <span className="kpi-hub-skpi-kpi__hint--warn">Actual Unverified</span>
        </article>
        <article
          className={`kpi-hub-skpi-kpi${data.quotes_score_gte_70 ? ' kpi-hub-skpi-kpi--critical kpi-hub-skpi-kpi--tint-critical' : ''}`}
        >
          <label>{WAR_ROOM_TILE_LABELS.quoteScore}</label>
          <b>{String(data.quotes_score_gte_70).padStart(2, '0')}</b>
          <span className="kpi-hub-skpi-kpi__hint--critical">Cùng GM dưới floor</span>
        </article>
      </div>

      <SkpiTwoColumnLayout
        className="kpi-hub-skpi-warroom__body"
        main={
          <div className="kpi-hub-skpi-warroom__stack">
            <article className="kpi-hub-card">
              <header className="kpi-hub-card__head kpi-hub-skpi-section-head">
                <h2>Hàng đợi việc — hôm nay</h2>
                <span className="kpi-hub-muted">Owner → due</span>
              </header>
              <div className="kpi-hub-card__body">
                {data.queue.length ? (
                  <ul className="kpi-hub-skpi-queue-list">
                    {data.queue.map((item) => (
                      <SkpiQueueRow key={`${item.href}-${item.title}`} item={item} />
                    ))}
                  </ul>
                ) : (
                  <p className="kpi-hub-muted">Không có mục ưu tiên.</p>
                )}
              </div>
            </article>
            <SkpiDvHealthList rows={data.dv_health} />
          </div>
        }
        aside={<SkpiWeeklyRhythm data={data} />}
      />
    </div>
  );
}
