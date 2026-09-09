import React from 'react';

type Cell = { value: number | null; label: string; hint: string };

export function PmLedgers({
  quoted,
  assigned,
  verified,
}: {
  quoted: Cell;
  assigned: Cell;
  verified: Cell;
}) {
  const fmt = (n: number | null) => (n == null ? 'Pending' : n.toLocaleString('vi-VN'));
  return (
    <div className="kpi-hub-pm-ledgers">
      <article className="kpi-hub-card kpi-hub-pm-ledger">
        <label>SỔ QUOTED</label>
        <b>{fmt(quoted.value)}</b>
        <span>{quoted.hint}</span>
      </article>
      <article className="kpi-hub-card kpi-hub-pm-ledger">
        <label>SỔ ASSIGNED</label>
        <b>{fmt(assigned.value)}</b>
        <span>{assigned.hint}</span>
      </article>
      <article className="kpi-hub-card kpi-hub-pm-ledger">
        <label>SỔ VERIFIED</label>
        <b>{fmt(verified.value)}</b>
        <span>{verified.hint}</span>
      </article>
    </div>
  );
}
