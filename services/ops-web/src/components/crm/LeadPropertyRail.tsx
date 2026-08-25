import type { ReactNode } from 'react';
import type { LeadRow } from '@/lib/api';
import { leadPropertyRows } from '@/lib/crm/lead-property-rows';

export function LeadPropertyRail({
  lead,
  ownerLabel,
  contact,
  statusForm,
  assignForm,
  extra,
}: {
  lead: LeadRow;
  ownerLabel?: string | null;
  contact?: ReactNode;
  statusForm: ReactNode;
  assignForm: ReactNode;
  extra?: ReactNode;
}) {
  const rows = leadPropertyRows(lead, ownerLabel);
  return (
    <aside className="lead-property-rail" data-testid="lead-property-rail">
      <h2 className="lead-property-rail__title">Thuộc tính</h2>
      {contact}
      <dl className="lead-property-rail__list">
        {rows.map((row) => (
          <div key={row.key} className="lead-property-rail__row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {statusForm}
      {assignForm}
      {extra}
    </aside>
  );
}
