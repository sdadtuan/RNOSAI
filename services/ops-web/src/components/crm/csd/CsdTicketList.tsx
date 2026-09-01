'use client';

import Link from 'next/link';
import {
  CSD_PRIORITY_LABELS,
  CSD_SLA_LABELS,
  CSD_STATUS_LABELS,
  formatCsdWhen,
  type CsdTicketRow,
} from '@/lib/crm/csd-api';

type CsdTicketListProps = {
  items: CsdTicketRow[];
  activeId?: string | null;
  onSelect?: (row: CsdTicketRow) => void;
};

function slaClass(status: string): string {
  return `csd-sla csd-sla--${status.replace(/_/g, '-')}`;
}

export function CsdTicketList({ items, activeId, onSelect }: CsdTicketListProps) {
  return (
    <div className="data-table-wrap" data-testid="csd-ticket-list">
      <table className="data-table csd-ticket-table">
        <thead>
          <tr>
            <th>Mã</th>
            <th>Tiêu đề</th>
            <th>Ưu tiên</th>
            <th>Trạng thái</th>
            <th>SLA</th>
            <th>Phụ trách</th>
            <th>Cập nhật</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={7} className="muted">
                Chưa có ticket Service Desk
              </td>
            </tr>
          ) : (
            items.map((row) => (
              <tr
                key={row.id}
                className={activeId === row.id ? 'is-highlighted' : undefined}
                onClick={() => onSelect?.(row)}
                style={onSelect ? { cursor: 'pointer' } : undefined}
                data-testid={`csd-ticket-row-${row.code}`}
              >
                <td>
                  <Link href={`/crm/csd/tickets/${row.id}`} onClick={(e) => e.stopPropagation()}>
                    {row.code}
                  </Link>
                </td>
                <td>{row.title}</td>
                <td>{CSD_PRIORITY_LABELS[row.priority] ?? row.priority}</td>
                <td>{CSD_STATUS_LABELS[row.status] ?? row.status}</td>
                <td>
                  <span className={slaClass(row.sla_status)}>
                    {CSD_SLA_LABELS[row.sla_status] ?? row.sla_status}
                  </span>
                </td>
                <td>{row.assignee_staff_name ?? '—'}</td>
                <td className="muted">{formatCsdWhen(row.updated_at)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
