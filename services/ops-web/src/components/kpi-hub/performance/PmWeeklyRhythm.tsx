import React from 'react';
import Link from 'next/link';
import { RHYTHM_CTA } from '@/lib/performance-copy';

export function PmWeeklyRhythm({
  items,
}: {
  items: Array<{ id: string; title: string; body: string; href: string; cta_label?: string }>;
}) {
  return (
    <div className="kpi-hub-pm-rhythm">
      {items.map((row, i) => (
        <div className="kpi-hub-pm-rhythm__row" key={row.id}>
          <i>{i + 1}</i>
          <div style={{ flex: 1 }}>
            <b>{row.title}</b>
            <p>{row.body}</p>
          </div>
          <Link href={row.href} className="kpi-hub-btn kpi-hub-btn--ghost kpi-hub-btn--sm">
            {row.cta_label ?? RHYTHM_CTA[row.id] ?? 'Mở'}
          </Link>
        </div>
      ))}
    </div>
  );
}
