'use client';

import Link from 'next/link';
import type { ServiceKpiWarRoomQueueItem } from '@/lib/service-kpi-types';

function badgeClass(badge: string): string {
  const lower = badge.toLowerCase();
  if (lower.includes('block') || lower.includes('at-risk') || lower.includes('critical')) {
    return 'kpi-hub-badge--red';
  }
  if (lower.includes('assumption') || lower.includes('stale') || lower.includes('pending')) {
    return 'kpi-hub-badge--amber';
  }
  return 'kpi-hub-badge--amber';
}

type Props = {
  item: ServiceKpiWarRoomQueueItem;
};

export function SkpiQueueRow({ item }: Props) {
  const actionHref = item.action_href ?? item.href;
  const actionLabel = item.action_label ?? 'Mở';

  return (
    <li className="kpi-hub-skpi-queue-row">
      <div className="kpi-hub-skpi-queue-row__body">
        <strong>{item.title}</strong>
        <span>{item.subtitle}</span>
      </div>
      {item.badge ? (
        <span className={`kpi-hub-badge ${badgeClass(item.badge)}`}>{item.badge}</span>
      ) : null}
      <Link href={actionHref} className="kpi-hub-btn kpi-hub-btn--ghost kpi-hub-btn--sm">
        {actionLabel}
      </Link>
    </li>
  );
}
