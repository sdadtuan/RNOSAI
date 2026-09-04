'use client';

import { useState } from 'react';
import type { CommandCenterResponse } from '@/lib/command-center-types';

type Props = {
  sales: NonNullable<CommandCenterResponse['sales']>;
  testId?: string;
};

type Tab = 'team' | 'rep' | 'source' | 'product';

const TABS: { id: Tab; label: string }[] = [
  { id: 'team', label: 'Theo Team' },
  { id: 'rep', label: 'Theo nhân viên' },
  { id: 'source', label: 'Theo nguồn lead' },
  { id: 'product', label: 'Theo sản phẩm' },
];

export function SalesTeamTable({ sales, testId = 'sales-team-table' }: Props) {
  const [tab, setTab] = useState<Tab>('team');
  const rows = sales.team_rows;

  return (
    <article className="kpi-hub-card cc-team-table" data-testid={testId}>
      <header className="kpi-hub-card__head">
        <h2>Hiệu suất theo Sales Team</h2>
      </header>
      <div className="cc-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'is-active' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="cc-empty">Chưa có dữ liệu hiệu suất {TABS.find((t) => t.id === tab)?.label.toLowerCase()}.</p>
      ) : (
        <div className="kpi-hub-table-wrap">
          <table className="kpi-hub-table">
            <thead>
              <tr>
                <th>Tên</th>
                <th>SQL</th>
                <th>Hẹn</th>
                <th>Pipeline</th>
                <th>Doanh thu</th>
                <th>Win Rate</th>
                <th>Response</th>
                <th>Contact Rate</th>
                <th>Target</th>
                <th>DQ%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={String(row.id ?? i)}>
                  <td>{String(row.name ?? '—')}</td>
                  <td>{row.sql != null ? String(row.sql) : '—'}</td>
                  <td>{row.appointments != null ? String(row.appointments) : '—'}</td>
                  <td>{row.pipeline != null ? String(row.pipeline) : '—'}</td>
                  <td>{row.revenue != null ? String(row.revenue) : '—'}</td>
                  <td>{row.win_rate != null ? String(row.win_rate) : '—'}</td>
                  <td>{row.response != null ? String(row.response) : '—'}</td>
                  <td>{row.contact_rate != null ? String(row.contact_rate) : '—'}</td>
                  <td>{row.target != null ? String(row.target) : '—'}</td>
                  <td>{row.dq_pct != null ? String(row.dq_pct) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
