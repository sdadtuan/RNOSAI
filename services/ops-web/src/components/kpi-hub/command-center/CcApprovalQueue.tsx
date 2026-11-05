'use client';

import Link from 'next/link';
import type { CommandCenterResponse } from '@/lib/command-center-types';

type Props = {
  approvals: CommandCenterResponse['approvals'];
  testId?: string;
};

export function CcApprovalQueue({ approvals, testId = 'exec-approvals' }: Props) {
  return (
    <article className="kpi-hub-card cc-approvals" data-testid={testId}>
      <header className="kpi-hub-card__head">
        <h2>Approval Queue</h2>
        <Link href="/crm/kpi-hub/approvals" className="kpi-hub-btn kpi-hub-btn--ghost">
          Review
        </Link>
      </header>
      <div className="cc-approvals__counts">
        <div className="cc-approvals__count">
          <strong>{approvals.kpi_count}</strong>
          <span>KPI duyệt</span>
        </div>
        <div className="cc-approvals__count">
          <strong>{approvals.target_count}</strong>
          <span>Đổi target</span>
        </div>
        <div className="cc-approvals__count">
          <strong>{approvals.mapping_count}</strong>
          <span>Mapping</span>
        </div>
      </div>
      <ul className="cc-approvals__recent">
        {approvals.recent.length === 0 ? (
          <li className="cc-empty">Không có mục chờ duyệt.</li>
        ) : (
          approvals.recent.slice(0, 3).map((item) => (
            <li key={item.id}>
              <span className="cc-approvals__kind">{item.kind}</span>
              <span>{item.label}</span>
            </li>
          ))
        )}
      </ul>
    </article>
  );
}
