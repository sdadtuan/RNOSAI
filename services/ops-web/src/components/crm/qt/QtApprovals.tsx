'use client';

import React, { useState } from 'react';
import { dash } from '@/lib/crm/qt-format';

export const QT_APPROVAL_CHIPS = [
  { id: 'mine', label: 'Chờ tôi' },
  { id: 'done', label: 'Đã xử lý' },
  { id: 'sla', label: 'SLA vỡ' },
] as const;

export type QtApprovalChipId = (typeof QT_APPROVAL_CHIPS)[number]['id'];

export type QtApprovalRow = {
  quote_code?: string | null;
  trigger?: string | null;
  step?: string | null;
  sla?: string | null;
  owner?: string | null;
};

export function QtApprovalsInbox({
  items = [],
  chip = 'mine',
  onChip,
}: {
  items?: QtApprovalRow[];
  chip?: QtApprovalChipId;
  onChip?: (id: QtApprovalChipId) => void;
}) {
  return (
    <div className="qt-approvals">
      <header className="qt-head">
        <div>
          <p className="qt-crumb">Kinh doanh / Báo giá / Phê duyệt</p>
          <h1>Hộp thư phê duyệt</h1>
          <p className="qt-muted">APR-01 · queue theo bước user được route</p>
        </div>
      </header>
      <div className="qt-filters">
        {QT_APPROVAL_CHIPS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`qt-chip${chip === item.id ? ' qt-chip--on' : ''}`}
            onClick={onChip ? () => onChip(item.id) : undefined}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="qt-table-wrap">
        <table className="qt-table">
          <thead>
            <tr>
              <th>Quote</th>
              <th>Trigger</th>
              <th>Bước</th>
              <th>SLA</th>
              <th>Owner</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.length ? (
              items.map((row, index) => (
                <tr key={`${row.quote_code ?? 'row'}-${index}`}>
                  <td>{dash(row.quote_code)}</td>
                  <td>{dash(row.trigger)}</td>
                  <td>{dash(row.step)}</td>
                  <td>{dash(row.sla)}</td>
                  <td>{dash(row.owner)}</td>
                  <td>
                    <button type="button" className="qt-btn" disabled>
                      Mở
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="qt-empty" colSpan={6}>
                  {dash(null)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function QtApprovals() {
  const [chip, setChip] = useState<QtApprovalChipId>('mine');
  return <QtApprovalsInbox items={[]} chip={chip} onChip={setChip} />;
}
