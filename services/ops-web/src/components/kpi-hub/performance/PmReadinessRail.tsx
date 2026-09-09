import React from 'react';

export function PmReadinessRail({
  gates,
}: {
  gates: Array<{ id: string; status: string; detail: string }>;
}) {
  return (
    <div className="kpi-hub-pm-gate">
      {gates.map((g) => (
        <div className="kpi-hub-pm-gate__row" key={g.id}>
          <span>{g.detail}</span>
          <b className={`is-${g.status}`}>
            {g.status === 'pass' ? 'Pass' : g.status === 'pending' ? 'Pending map' : 'Fail'}
          </b>
        </div>
      ))}
    </div>
  );
}
