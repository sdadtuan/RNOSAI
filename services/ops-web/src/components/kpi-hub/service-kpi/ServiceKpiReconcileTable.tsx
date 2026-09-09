'use client';

import type { ServiceKpiReconcileRow } from '@/lib/service-kpi-types';

type Props = {
  rows: ServiceKpiReconcileRow[];
  sourceId: string;
  dictionaryLabels?: Record<string, string>;
};

export function ServiceKpiReconcileTable({ rows, sourceId, dictionaryLabels = {} }: Props) {
  if (!sourceId) {
    return <p className="kpi-hub-muted">Nhập source_id (quote line) để đối soát 3 sổ.</p>;
  }
  if (!rows.length) {
    return <p className="kpi-hub-empty">Không có dữ liệu reconcile cho {sourceId}.</p>;
  }
  return (
    <div className="kpi-hub-table-wrap">
      <table className="kpi-hub-table">
        <thead>
          <tr>
            <th>KPI</th>
            <th>Quoted</th>
            <th>Delivered</th>
            <th>Reported</th>
            <th>Quality</th>
            <th>Hành vi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.instance_id}>
              <td>
                <span className="kpi-hub-table__mono">
                  {dictionaryLabels[row.dictionary_id] ?? row.dictionary_id}
                </span>
                <div className="kpi-hub-table__sub">{row.classification}</div>
              </td>
              <td>{formatCell(row.quoted)}</td>
              <td>{formatCell(row.delivered)}</td>
              <td>{formatCell(row.reported)}</td>
              <td>{row.quality_status}</td>
              <td>
                {row.behavior}
                {row.material_variance ? (
                  <span className="kpi-hub-badge kpi-hub-badge--amber" style={{ marginLeft: 6 }}>
                    Material
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === 'Blocked') return 'Blocked';
  if (value == null) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
