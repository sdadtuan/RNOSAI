'use client';

import Link from 'next/link';
import { useState } from 'react';
import { KpiTypeStatusBadge } from '@/components/kpi-types/KpiTypeStatusBadge';
import { labelKpiTypeCalc, labelKpiTypeDirection } from '@/lib/kpi-type-util';
import type { KpiTypeListItem } from '@/lib/kpi-types-api';

export type KpiTypeRowAction = 'view' | 'edit' | 'duplicate' | 'activate' | 'deactivate' | 'delete';

export function KpiTypeTable({
  rows,
  canManage,
  busy,
  onAction,
}: {
  rows: KpiTypeListItem[];
  canManage: boolean;
  busy?: boolean;
  onAction: (action: KpiTypeRowAction, row: KpiTypeListItem) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="kpi-type-table-wrap">
      <table className="kpi-type-table data-table">
        <thead>
          <tr>
            <th>KPI Type</th>
            <th>Nhóm KPI</th>
            <th>Đơn vị</th>
            <th>Hướng đo</th>
            <th>Nguồn</th>
            <th>Tự động hóa</th>
            <th>Đang dùng</th>
            <th>Trạng thái</th>
            <th>Cập nhật</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <div className="kpi-type-table__name-cell">
                  <Link href={`/crm/kpi/types/${row.id}`} className="kpi-type-table__title nav-link">
                    {row.name}
                  </Link>
                  <span className="kpi-type-table__meta muted">
                    {row.code}
                    {row.short_name ? ` · ${row.short_name}` : ''}
                  </span>
                </div>
              </td>
              <td>
                {row.kpi_group ? (
                  <span
                    className="kpi-type-group-badge"
                    style={{ borderColor: row.kpi_group.color, color: row.kpi_group.color }}
                  >
                    {row.kpi_group.name}
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td>{row.unit?.name ?? '—'}</td>
              <td>{labelKpiTypeDirection(row.direction)}</td>
              <td>
                {row.data_source?.name ?? '—'}
                {row.data_source?.health ? (
                  <span className={`kpi-type-health kpi-type-health--${row.data_source.health.toLowerCase()}`}>
                    {row.data_source.health}
                  </span>
                ) : null}
              </td>
              <td>{labelKpiTypeCalc(row.calculation_mode)}</td>
              <td className="kpi-type-table__usage">{row.usage_count}</td>
              <td>
                <KpiTypeStatusBadge status={row.status} />
              </td>
              <td className="kpi-type-table__updated">
                <span>{row.updated_at ? new Date(row.updated_at).toLocaleString('vi-VN') : '—'}</span>
                <span className="muted">{row.updated_by?.name ?? ''}</span>
              </td>
              <td>
                <div className="kpi-type-row-menu">
                  <button
                    type="button"
                    className="btn btn-xs btn-ghost kpi-type-row-menu__trigger"
                    disabled={busy}
                    onClick={() => setOpenId(openId === row.id ? null : row.id)}
                    aria-label="Thao tác"
                  >
                    ⋮
                  </button>
                  {openId === row.id ? (
                    <div className="kpi-type-row-menu__panel">
                      <button type="button" className="kpi-type-row-menu__item" onClick={() => onAction('view', row)}>
                        Xem chi tiết
                      </button>
                      {canManage ? (
                        <>
                          <button type="button" className="kpi-type-row-menu__item" onClick={() => onAction('edit', row)}>
                            Chỉnh sửa
                          </button>
                          <button
                            type="button"
                            className="kpi-type-row-menu__item"
                            onClick={() => onAction('duplicate', row)}
                          >
                            Nhân bản
                          </button>
                          {row.status === 'ACTIVE' ? (
                            <button
                              type="button"
                              className="kpi-type-row-menu__item"
                              onClick={() => onAction('deactivate', row)}
                            >
                              Ngừng sử dụng
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="kpi-type-row-menu__item"
                              onClick={() => onAction('activate', row)}
                            >
                              Kích hoạt
                            </button>
                          )}
                          <button
                            type="button"
                            className="kpi-type-row-menu__item is-danger"
                            onClick={() => onAction('delete', row)}
                          >
                            Xóa
                          </button>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
