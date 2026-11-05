'use client';

import type { ReactNode } from 'react';

export type CpTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
};

type CpDataTableProps<T> = {
  columns: CpTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
};

export function CpDataTable<T>({ columns, rows, rowKey, empty }: CpDataTableProps<T>) {
  if (!rows.length) {
    return (
      <div className="cp-tbl-wrap">
        <p className="cp-muted">{empty ?? 'Không có dữ liệu'}</p>
      </div>
    );
  }
  return (
    <div className="cp-tbl-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((col) => (
                <td key={col.key}>{col.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
