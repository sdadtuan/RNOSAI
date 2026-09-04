'use client';

import type { CSSProperties } from 'react';
import type { KpiHubDictionaryRow } from '@/lib/kpi-hub-fixtures';
import { KpiHubStatusBadge } from '../KpiHubStatusBadge';
import { KpiHubDictPagination } from './KpiHubDictPagination';
import { KpiHubDictRowMenu } from './KpiHubDictRowMenu';
import { KpiHubSourceChips } from './KpiHubSourceChips';

type Props = {
  rows: KpiHubDictionaryRow[];
  selectedId?: string | null;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onSelect: (row: KpiHubDictionaryRow) => void;
};

export function KpiHubDictTable({
  rows,
  selectedId,
  page,
  pageSize,
  total,
  onPageChange,
  onSelect,
}: Props) {
  return (
    <div className="kpi-hub-dict-table">
      <div className="kpi-hub-table-wrap">
        <table className="kpi-hub-table">
          <thead>
            <tr>
              <th>KPI ID</th>
              <th>Tên Metric</th>
              <th>Nhóm KPI</th>
              <th>Nguồn dữ liệu</th>
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
                <td>
                  <KpiHubSourceChips source={row.source} sources={row.sources} />
                </td>
                <td>{row.frequency}</td>
                <td>{row.dataOwnerRole ?? row.dataOwner}</td>
                <td>
                  <KpiHubStatusBadge kind="dict" status={row.status} />
                </td>
                <td>
                  <KpiHubDictRowMenu row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <KpiHubDictPagination page={page} pageSize={pageSize} total={total} onPageChange={onPageChange} />
    </div>
  );
}
