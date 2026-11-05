'use client';

import type { KpiHubTargetRow } from '@/lib/kpi-hub-types';
import { KpiHubStatusBadge } from '../KpiHubStatusBadge';

type Props = {
  rows: KpiHubTargetRow[];
  onSelect: (id: string) => void;
  selectedId?: string | null;
};

export function KpiHubTargetTable({ rows, onSelect, selectedId }: Props) {
  return (
    <div className="kpi-hub-table-wrap">
      <table className="kpi-hub-table">
        <thead>
          <tr>
            <th>KPI</th>
            <th>Actual</th>
            <th>Target</th>
            <th>Warning</th>
            <th>Critical</th>
            <th>Trend</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={selectedId === row.id ? 'is-selected' : ''}
              onClick={() => onSelect(row.id)}
            >
              <td>
                <strong>{row.name}</strong>
                <span className="kpi-hub-table__mono">{row.code}</span>
              </td>
              <td>{row.actualFmt}</td>
              <td>{row.targetFmt}</td>
              <td>{row.warning ?? '—'}</td>
              <td>{row.critical ?? '—'}</td>
              <td>
                <span className={`kpi-hub-trend kpi-hub-trend--${row.trend}`} aria-hidden>
                  {row.trend === 'up' ? '↑' : row.trend === 'down' ? '↓' : '→'}
                </span>
              </td>
              <td>
                <KpiHubStatusBadge kind="perf" status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
