'use client';

import type { ServiceKpiReconcileRow } from '@/lib/service-kpi-types';

type Props = {
  rows: ServiceKpiReconcileRow[];
  sourceId: string;
  dictionaryLabels?: Record<string, string>;
};

function qualityTone(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('verified') || s === 'valid') return 'green';
  if (s.includes('pending') || s.includes('assumption')) return 'amber';
  if (s.includes('block') || s.includes('fail')) return 'red';
  return 'gray';
}

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
            <th>Quoted (accept)</th>
            <th>Delivered (nội bộ)</th>
            <th>Reported (khách)</th>
            <th>Quality</th>
            <th>Hành vi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.instance_id}>
              <td>
                <span className="kpi-hub-table__mono kpi-hub-linkish">
                  {dictionaryLabels[row.dictionary_id] ?? row.dictionary_id}
                </span>
                <div className="kpi-hub-table__sub">{row.classification}</div>
              </td>
              <td>{formatCell(row.quoted)}</td>
              <td>
                <b>{formatCell(row.delivered)}</b>
              </td>
              <td className={row.reported === 'Blocked' ? 'kpi-hub-skpi-variance--bad' : undefined}>
                {formatCell(row.reported)}
              </td>
              <td>
                <span className={`kpi-hub-badge kpi-hub-badge--${qualityTone(row.quality_status)}`}>
                  {row.quality_status}
                </span>
              </td>
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
