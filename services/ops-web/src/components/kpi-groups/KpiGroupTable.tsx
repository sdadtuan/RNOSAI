'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { KpiGroupStatusBadge } from '@/components/kpi-groups/KpiGroupStatusBadge';
import type { KpiGroupListItem } from '@/lib/kpi-groups-api';
import { kpiGroupDirectionIcon, labelKpiGroupDirection, labelKpiGroupScope } from '@/lib/kpi-group-util';

export type KpiGroupRowAction = 'view' | 'edit' | 'duplicate' | 'deactivate' | 'activate' | 'delete';

type KpiGroupTableProps = {
  rows: KpiGroupListItem[];
  canManage: boolean;
  canReorder?: boolean;
  busy?: boolean;
  onAction: (action: KpiGroupRowAction, row: KpiGroupListItem) => void;
  onReorder?: (items: Array<{ id: string; display_order: number }>) => Promise<void>;
};

function formatUpdatedAt(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function scopeTags(row: KpiGroupListItem): string {
  if (row.scope_type === 'ORGANIZATION') return 'Toàn doanh nghiệp';
  if (row.departments.length) return row.departments.map((d) => d.name).join(', ');
  return labelKpiGroupScope(row.scope_type);
}

function buildReorderPayload(nextRows: KpiGroupListItem[]): Array<{ id: string; display_order: number }> {
  const orderValues = [...nextRows.map((r) => r.display_order)].sort((a, b) => a - b);
  return nextRows.map((row, index) => ({
    id: row.id,
    display_order: orderValues[index] ?? index + 1,
  }));
}

function reorderList(rows: KpiGroupListItem[], dragId: string, targetId: string): KpiGroupListItem[] {
  const from = rows.findIndex((r) => r.id === dragId);
  const to = rows.findIndex((r) => r.id === targetId);
  if (from < 0 || to < 0 || from === to) return rows;
  const next = [...rows];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  const payload = buildReorderPayload(next);
  return next.map((row, index) => ({
    ...row,
    display_order: payload[index]?.display_order ?? row.display_order,
  }));
}

function RowMenu({
  row,
  canManage,
  busy,
  onAction,
}: {
  row: KpiGroupListItem;
  canManage: boolean;
  busy?: boolean;
  onAction: KpiGroupTableProps['onAction'];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const items: Array<{ action: KpiGroupRowAction; label: string; danger?: boolean }> = [
    { action: 'view', label: 'Xem' },
    { action: 'edit', label: 'Sửa' },
  ];
  if (canManage) {
    items.push({ action: 'duplicate', label: 'Nhân bản' });
    if (row.status === 'ACTIVE') {
      items.push({ action: 'deactivate', label: 'Ngừng sử dụng' });
    } else if (row.status === 'INACTIVE' || row.status === 'DRAFT') {
      items.push({ action: 'activate', label: 'Kích hoạt' });
    }
    items.push({ action: 'delete', label: 'Xóa', danger: true });
  }

  return (
    <div className="kpi-group-row-menu" ref={ref}>
      <button
        type="button"
        className="btn btn-xs btn-ghost kpi-group-row-menu__trigger"
        aria-label="Thao tác"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
      >
        ⋮
      </button>
      {open ? (
        <div className="kpi-group-row-menu__panel" role="menu">
          {items.map((item) => (
            <button
              key={item.action}
              type="button"
              role="menuitem"
              className={`kpi-group-row-menu__item${item.danger ? ' is-danger' : ''}`}
              onClick={() => {
                setOpen(false);
                onAction(item.action, row);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function KpiGroupTable({
  rows: initialRows,
  canManage,
  canReorder,
  busy,
  onAction,
  onReorder,
}: KpiGroupTableProps) {
  const [rows, setRows] = useState(initialRows);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [reorderBusy, setReorderBusy] = useState(false);
  const snapshotRef = useRef(initialRows);

  useEffect(() => {
    setRows(initialRows);
    snapshotRef.current = initialRows;
  }, [initialRows]);

  async function onDrop(targetId: string) {
    if (!canReorder || !onReorder || !dragId || dragId === targetId || reorderBusy) return;
    const previous = rows;
    const next = reorderList(rows, dragId, targetId);
    setRows(next);
    setDragId(null);
    setDragOverId(null);
    setReorderBusy(true);
    try {
      await onReorder(buildReorderPayload(next));
      snapshotRef.current = next;
    } catch {
      setRows(previous);
    } finally {
      setReorderBusy(false);
    }
  }

  const reorderEnabled = Boolean(canReorder && onReorder && !busy && !reorderBusy);

  return (
    <div className="kpi-group-table-wrap data-table-wrap">
      {reorderEnabled ? (
        <p className="kpi-group-reorder-hint muted">Kéo biểu tượng ⋮⋮ để đổi thứ tự hiển thị trên trang này.</p>
      ) : null}
      <table className="kpi-group-table data-table">
        <thead>
          <tr>
            <th style={{ width: 40 }} aria-label="Sắp xếp" />
            <th style={{ width: 56 }}>#</th>
            <th>Nhóm KPI</th>
            <th>Phạm vi áp dụng</th>
            <th>Hướng đo mặc định</th>
            <th style={{ width: 100 }}>Chỉ tiêu</th>
            <th style={{ width: 130 }}>Trạng thái</th>
            <th style={{ width: 180 }}>Cập nhật gần nhất</th>
            <th style={{ width: 48 }} aria-label="Thao tác" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={dragOverId === row.id ? 'kpi-group-table__row--over' : undefined}
              onDragOver={(e) => {
                if (!reorderEnabled || !dragId) return;
                e.preventDefault();
                setDragOverId(row.id);
              }}
              onDragLeave={() => {
                if (dragOverId === row.id) setDragOverId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                void onDrop(row.id);
              }}
            >
              <td>
                {reorderEnabled ? (
                  <button
                    type="button"
                    className="kpi-group-drag-handle"
                    draggable
                    aria-label={`Kéo để sắp xếp ${row.name}`}
                    onDragStart={(e) => {
                      setDragId(row.id);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', row.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setDragOverId(null);
                    }}
                  >
                    ⋮⋮
                  </button>
                ) : null}
              </td>
              <td className="kpi-group-table__order">{row.display_order}</td>
              <td>
                <div className="kpi-group-table__name-cell">
                  <span className="kpi-group-table__icon" style={{ backgroundColor: row.color }} aria-hidden>
                    {row.icon ? row.icon.slice(0, 1).toUpperCase() : row.code.slice(0, 1)}
                  </span>
                  <div>
                    <Link href={`/crm/kpi/groups/${row.id}`} className="kpi-group-table__title nav-link">
                      {row.name}
                    </Link>
                    <div className="kpi-group-table__meta">
                      <code>{row.code}</code>
                      {row.description ? <span className="muted">{row.description}</span> : null}
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <div className="kpi-group-table__tags">{scopeTags(row)}</div>
              </td>
              <td>
                <span className="kpi-group-direction">
                  <span aria-hidden>{kpiGroupDirectionIcon(row.default_direction)}</span>
                  {labelKpiGroupDirection(row.default_direction)}
                </span>
              </td>
              <td>
                <span className="kpi-group-table__usage">{row.usage_count.toLocaleString('vi-VN')}</span>
              </td>
              <td>
                <KpiGroupStatusBadge status={row.status} />
              </td>
              <td>
                <div className="kpi-group-table__updated">
                  <span>{formatUpdatedAt(row.updated_at)}</span>
                  {row.updated_by?.name ? <span className="muted">{row.updated_by.name}</span> : null}
                </div>
              </td>
              <td>
                <RowMenu row={row} canManage={canManage} busy={busy || reorderBusy} onAction={onAction} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
