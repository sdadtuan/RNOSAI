'use client';

import Link from 'next/link';
import { formatCsdWhen, type CsdEmailRow } from '@/lib/crm/csd-api';

type CsdEmailInboxProps = {
  items: CsdEmailRow[];
  unmatchedHref?: string;
  onCompose?: () => void;
};

export function CsdEmailInbox({ items, unmatchedHref, onCompose }: CsdEmailInboxProps) {
  return (
    <div className="stack-gap" data-testid="csd-email-inbox">
      <div className="csd-email-inbox__head">
        {unmatchedHref ? (
          <Link href={unmatchedHref} className="btn btn-sm btn-secondary">
            Email chưa khớp
          </Link>
        ) : null}
        {onCompose ? (
          <button type="button" className="btn btn-sm" onClick={onCompose}>
            Soạn email
          </button>
        ) : null}
      </div>
      <div className="data-table-wrap">
        <table className="data-table csd-email-table">
          <thead>
            <tr>
              <th>Hướng</th>
              <th>Tiêu đề</th>
              <th>Từ / Đến</th>
              <th>Ticket</th>
              <th>Thời gian</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  Hộp thư trống
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id}>
                  <td>{row.direction === 'inbound' ? 'Đến' : 'Đi'}</td>
                  <td>{row.subject}</td>
                  <td className="muted">{row.from_address}</td>
                  <td>
                    {row.ticket_id ? (
                      <Link href={`/crm/csd/tickets/${row.ticket_id}`}>{row.ticket_code ?? row.ticket_id}</Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="muted">{formatCsdWhen(row.received_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
