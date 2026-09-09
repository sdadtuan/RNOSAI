'use client';

import type { ServiceKpiInstanceItem } from '@/lib/service-kpi-types';

const CLASS_BADGE: Record<string, string> = {
  COMMITTED_DELIVERABLE: 'blue',
  OPTIMIZATION_TARGET: 'purple',
  PROJECTED_RESULT: 'amber',
  BUSINESS_OUTCOME: 'amber',
  INTERNAL_OPERATIONAL: 'gray',
};

type Props = {
  rows: ServiceKpiInstanceItem[];
  onSelect?: (row: ServiceKpiInstanceItem) => void;
};

export function ServiceKpiInstanceTable({ rows, onSelect }: Props) {
  if (!rows.length) {
    return <div className="kpi-hub-empty"><p>Chưa có KPI instance — thêm DV vào Quote để kế thừa template.</p></div>;
  }
  return (
    <div className="kpi-hub-table-wrap">
      <table className="kpi-hub-table">
        <thead>
          <tr>
            <th>KPI / Source</th>
            <th>Classification</th>
            <th>Target / Scenario</th>
            <th>Actual</th>
            <th>Variance</th>
            <th>Readiness</th>
            <th>Owner</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} onClick={() => onSelect?.(row)} className={onSelect ? 'kpi-hub-row-clickable' : ''}>
              <td>
                <span className="kpi-hub-table__mono">{row.dictionary_id}</span>
                <div className="kpi-hub-table__sub">{row.source_type} · {row.source_id}</div>
              </td>
              <td>
                <span className={`kpi-hub-badge kpi-hub-badge--${CLASS_BADGE[row.classification] ?? 'gray'}`}>
                  {row.classification.replace(/_/g, ' ')}
                </span>
              </td>
              <td>
                {row.target_min ?? '—'} – {row.target_max ?? '—'}
                <div className="kpi-hub-table__sub">{row.scenario}</div>
              </td>
              <td>{row.latest_actual ?? '—'}</td>
              <td>{row.variance_pct != null ? `${row.variance_pct}%` : '—'}</td>
              <td>{row.readiness_level ?? '—'}</td>
              <td>{row.owner_name ?? '—'}</td>
              <td>
                <span className={`kpi-hub-badge kpi-hub-badge--${row.status === 'AT_RISK' ? 'red' : 'gray'}`}>
                  {row.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
