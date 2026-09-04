'use client';

import type { DeliveryProjectRow } from '@/lib/delivery-projects-api';

type DeliveryGanttProps = {
  rows: DeliveryProjectRow[];
};

function parseDate(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso.slice(0, 10));
  return Number.isNaN(t) ? null : t;
}

export function DeliveryGantt({ rows }: DeliveryGanttProps) {
  const withDates = rows.filter((r) => r.start_date && r.end_date);
  const minTs = withDates.reduce((min, r) => {
    const s = parseDate(r.start_date);
    return s != null && s < min ? s : min;
  }, Infinity);
  const maxTs = withDates.reduce((max, r) => {
    const e = parseDate(r.end_date);
    return e != null && e > max ? e : max;
  }, -Infinity);
  const span = maxTs > minTs ? maxTs - minTs : 1;

  return (
    <div className="delivery-panel" data-testid="delivery-gantt">
      <div className="delivery-panel__head">
        <h3 className="delivery-panel__title">Timeline</h3>
        <div className="delivery-tab-row">
          <button type="button" className="delivery-tab delivery-tab--active">
            Timeline
          </button>
          <button type="button" className="delivery-tab">
            Workload
          </button>
          <button type="button" className="delivery-tab">
            Theo PM
          </button>
        </div>
      </div>
      <div className="delivery-gantt-body">
        {withDates.length === 0 ? (
          <p className="delivery-empty-hint">Chưa có dự án có ngày bắt đầu/kết thúc.</p>
        ) : (
          withDates.map((row) => {
            const start = parseDate(row.start_date)!;
            const end = parseDate(row.end_date)!;
            const left = ((start - minTs) / span) * 100;
            const width = Math.max(2, ((end - start) / span) * 100);
            return (
              <div key={row.id} className="delivery-gantt-row">
                <span className="delivery-gantt-row__label">{row.code ?? row.ingest_code ?? row.name}</span>
                <div className="delivery-gantt-row__track">
                  <div
                    className="delivery-gantt-bar"
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${row.start_date} → ${row.end_date}`}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
