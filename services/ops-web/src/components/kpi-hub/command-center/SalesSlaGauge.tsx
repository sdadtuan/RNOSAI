'use client';

import Link from 'next/link';
import type { CommandCenterResponse } from '@/lib/command-center-types';

type Props = {
  sales: NonNullable<CommandCenterResponse['sales']>;
  testId?: string;
};

const BUCKET_LABELS = ['≤5 phút', '5–15 phút', '15–30 phút', '>30 phút'];
const BUCKET_KEYS = ['lte5', '5to15', '15to30', 'gt30'];

export function SalesSlaGauge({ sales, testId = 'sales-sla-gauge' }: Props) {
  const { sla } = sales;
  const pct =
    sla.actual_minutes != null && sla.target_minutes > 0
      ? Math.min(100, Math.round((sla.actual_minutes / sla.target_minutes) * 100))
      : null;

  return (
    <article className="kpi-hub-card cc-sla" data-testid={testId}>
      <header className="kpi-hub-card__head">
        <h2>SLA & Lead Response</h2>
      </header>
      <div className="cc-sla__gauge">
        <div className="cc-sla__value">
          {sla.actual_minutes != null ? `${sla.actual_minutes} phút` : '—'}
        </div>
        <div className="cc-sla__target">Mục tiêu ≤ {sla.target_minutes} phút</div>
        {pct != null ? (
          <div className="cc-sla__bar-wrap">
            <div className="cc-sla__bar" style={{ width: `${pct}%` }} />
          </div>
        ) : null}
      </div>
      <div className="cc-sla__stats muted">
        <span>Quá SLA: {sla.overdue_count}</span>
      </div>
      <div className="cc-sla__buckets">
        {BUCKET_KEYS.map((key, i) => (
          <div key={key} className="cc-sla__bucket">
            <span>{BUCKET_LABELS[i]}</span>
            <strong>{sla.buckets[key] ?? 0}</strong>
          </div>
        ))}
      </div>
      <Link href="/crm/leads?sla=overdue" className="kpi-hub-link-btn">
        Xem danh sách quá SLA
      </Link>
    </article>
  );
}
