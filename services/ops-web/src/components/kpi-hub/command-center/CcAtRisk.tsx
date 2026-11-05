'use client';

import Link from 'next/link';
import type { CommandCenterResponse } from '@/lib/command-center-types';
import { KpiHubStatusBadge } from '../KpiHubStatusBadge';

type Props = {
  items: CommandCenterResponse['at_risk'];
  title?: string;
  testId?: string;
};

function formatVs(actual: number | null, target: number | null): string {
  const a = actual != null ? String(actual) : '—';
  const t = target != null ? String(target) : '—';
  return `${a} / ${t}`;
}

export function CcAtRisk({ items, title = 'Target at Risk', testId = 'exec-at-risk' }: Props) {
  const sorted = [...items].sort((a, b) => {
    const order = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    const ai = order[a.severity as keyof typeof order] ?? 3;
    const bi = order[b.severity as keyof typeof order] ?? 3;
    return ai - bi;
  });

  return (
    <article className="kpi-hub-card cc-at-risk" data-testid={testId}>
      <header className="kpi-hub-card__head">
        <h2>{title}</h2>
        <Link href="/crm/kpi-hub/targets" className="kpi-hub-link-btn">
          Xem cảnh báo
        </Link>
      </header>
      {sorted.length === 0 ? (
        <p className="cc-empty">Không có KPI nào đang lệch target.</p>
      ) : (
        <ul className="cc-at-risk__list">
          {sorted.map((item) => (
            <li key={item.id} className="cc-at-risk__item">
              <KpiHubStatusBadge kind="perf" status={item.severity} />
              <div className="cc-at-risk__body">
                <strong>{item.name}</strong>
                <span className="muted">{item.scope}</span>
                <span>{formatVs(item.actual, item.target)}</span>
              </div>
              <div className="cc-at-risk__meta">
                {item.owner ? <span className="cc-avatar">{item.owner.charAt(0)}</span> : null}
                {item.sla_hours != null ? <span className="muted">SLA {item.sla_hours}h</span> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
