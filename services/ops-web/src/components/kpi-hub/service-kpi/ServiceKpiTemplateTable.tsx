'use client';

import type { ServiceKpiTemplateListItem } from '@/lib/service-kpi-types';

type Props = {
  rows: ServiceKpiTemplateListItem[];
  onConfigure: (row: ServiceKpiTemplateListItem) => void;
};

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Draft',
    IN_REVIEW: 'In Review',
    ACTIVE: 'Active',
    SUSPENDED: 'Suspended',
    RETIRED: 'Retired',
  };
  return map[status] ?? status;
}

function statusClass(status: string): string {
  if (status === 'ACTIVE') return 'green';
  if (status === 'IN_REVIEW') return 'amber';
  if (status === 'DRAFT') return 'gray';
  return 'gray';
}

export function ServiceKpiTemplateTable({ rows, onConfigure }: Props) {
  if (!rows.length) {
    return (
      <div className="kpi-hub-empty">
        <p>Chưa có template — tạo từ Portfolio 21 DV</p>
      </div>
    );
  }

  return (
    <div className="kpi-hub-table-wrap">
      <table className="kpi-hub-table">
        <thead>
          <tr>
            <th>Service / Template</th>
            <th>DV · bundle</th>
            <th>Required</th>
            <th>Client visible</th>
            <th>Owner</th>
            <th>Version</th>
            <th>Trạng thái</th>
            <th aria-label="Thao tác" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <span className="kpi-hub-table__mono kpi-hub-linkish">{row.name}</span>
                <div className="kpi-hub-table__sub">{row.dv_code}</div>
              </td>
              <td>{row.dv_code}</td>
              <td>{row.required_count ?? '—'}</td>
              <td>{row.client_visible_count ?? '—'}</td>
              <td>{row.owner_team || '—'}</td>
              <td>{row.active_version_id ? 'v' : 'v1'}</td>
              <td>
                <span className={`kpi-hub-badge kpi-hub-badge--${statusClass(row.status)}`}>
                  {statusLabel(row.status)}
                </span>
              </td>
              <td>
                <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost kpi-hub-btn--sm" onClick={() => onConfigure(row)}>
                  Cấu hình
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
