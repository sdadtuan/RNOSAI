'use client';

import { useMemo, useState } from 'react';
import type { CommandCenterResponse } from '@/lib/command-center-types';
import { KpiHubStatusBadge } from '../KpiHubStatusBadge';

type Props = {
  exceptions: CommandCenterResponse['exceptions'];
  testId?: string;
};

type Tab = 'all' | 'critical' | 'warning' | 'pending';

export function CcExceptions({ exceptions, testId = 'exec-exceptions' }: Props) {
  const [tab, setTab] = useState<Tab>('all');

  const filtered = useMemo(() => {
    switch (tab) {
      case 'critical':
        return exceptions.filter((e) => e.priority === 'CRITICAL');
      case 'warning':
        return exceptions.filter((e) => e.priority === 'WARNING');
      case 'pending':
        return exceptions.filter((e) => e.status === 'PENDING' || e.status === 'OPEN');
      default:
        return exceptions;
    }
  }, [exceptions, tab]);

  const criticalCount = exceptions.filter((e) => e.priority === 'CRITICAL').length;
  const warningCount = exceptions.filter((e) => e.priority === 'WARNING').length;
  const pendingCount = exceptions.filter(
    (e) => e.status === 'PENDING' || e.status === 'OPEN',
  ).length;

  return (
    <article className="kpi-hub-card cc-exceptions" data-testid={testId}>
      <header className="kpi-hub-card__head">
        <h2>Exceptions & Actions</h2>
      </header>
      <div className="cc-tabs" role="tablist">
        <button type="button" className={tab === 'all' ? 'is-active' : ''} onClick={() => setTab('all')}>
          Tất cả ({exceptions.length})
        </button>
        <button type="button" className={tab === 'critical' ? 'is-active' : ''} onClick={() => setTab('critical')}>
          Critical ({criticalCount})
        </button>
        <button type="button" className={tab === 'warning' ? 'is-active' : ''} onClick={() => setTab('warning')}>
          Warning ({warningCount})
        </button>
        <button type="button" className={tab === 'pending' ? 'is-active' : ''} onClick={() => setTab('pending')}>
          Chờ duyệt ({pendingCount})
        </button>
      </div>
      <div className="kpi-hub-table-wrap">
        <table className="kpi-hub-table">
          <thead>
            <tr>
              <th>Ưu tiên</th>
              <th>Đối tượng</th>
              <th>Vấn đề</th>
              <th>Tác động</th>
              <th>Owner</th>
              <th>SLA</th>
              <th>Trạng thái</th>
              <th>⋯</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="cc-empty">
                  Không có ngoại lệ trong tab này.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id}>
                  <td>
                    <KpiHubStatusBadge kind="perf" status={row.priority} />
                  </td>
                  <td>{row.object}</td>
                  <td>{row.issue}</td>
                  <td>{row.impact}</td>
                  <td>{row.owner ?? '—'}</td>
                  <td>{row.sla ?? '—'}</td>
                  <td>{row.status}</td>
                  <td>
                    <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost" disabled title="Cần ghi chú và quyền">
                      Resolve
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}
