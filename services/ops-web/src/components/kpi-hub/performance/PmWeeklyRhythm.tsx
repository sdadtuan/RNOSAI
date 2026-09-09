import React from 'react';
import Link from 'next/link';

export function PmWeeklyRhythm({
  items,
}: {
  items: Array<{ id: string; title: string; body: string; href: string }>;
}) {
  return (
    <div className="kpi-hub-pm-rhythm">
      {items.map((row, i) => (
        <div className="kpi-hub-pm-rhythm__row" key={row.id}>
          <i>{i + 1}</i>
          <div>
            <b>{row.title}</b>
            <p>{row.body}</p>
          </div>
          <Link href={row.href} className="kpi-hub-btn kpi-hub-btn--ghost">
            Mở
          </Link>
        </div>
      ))}
    </div>
  );
}
