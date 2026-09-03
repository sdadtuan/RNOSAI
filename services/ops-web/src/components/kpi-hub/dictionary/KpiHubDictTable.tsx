'use client';

import type { CSSProperties } from 'react';
import type { KpiHubDictionaryRow } from '@/lib/kpi-hub-fixtures';
import { KpiHubStatusBadge } from '../KpiHubStatusBadge';

type Props = {
  rows: KpiHubDictionaryRow[];
  selectedId?: string | null;
  onSelect: (row: KpiHubDictionaryRow) => void;
  onMenu?: (row: KpiHubDictionaryRow) => void;
};

export function KpiHubDictTable({ rows, selectedId, onSelect, onMenu }: Props) {
  return (
    <div className="kpi-hub-table-wrap">
      <table className="kpi-hub-table">
        <thead>
          <tr>
            <th>KPI ID</th>
            <th>Tên Metric</th>
            <th>Nhóm KPI</th>
            <th>Nguồn</th>
            <th>Tần suất</th>
            <th>Data Owner</th>
            <th>Trạng thái</th>
            <th aria-label="Thao tác" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={selectedId === row.id ? 'is-selected' : ''}
              onClick={() => onSelect(row)}
            >
              <td className="kpi-hub-table__mono">{row.code}</td>
              <td>{row.name}</td>
              <td>
                <span className="kpi-hub-group-badge" style={{ '--badge-color': row.groupColor } as CSSProperties}>
                  {row.groupLabel}
                </span>
              </td>
              <td>{row.source}</td>
              <td>{row.frequency}</td>
              <td>{row.dataOwner}</td>
              <td>
                <KpiHubStatusBadge kind="dict" status={row.status} />
              </td>
              <td>
                <button
                  type="button"
                  className="kpi-hub-row-menu-btn"
                  aria-label="Menu"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMenu?.(row);
                  }}
                >
                  ⋮
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
