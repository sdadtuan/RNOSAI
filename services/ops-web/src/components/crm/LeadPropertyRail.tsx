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
  variant = 'full',
  includeContactFields,
  omitKeys,
}: {
  lead: LeadRow;
  ownerLabel?: string | null;
  contact?: ReactNode;
  statusForm: ReactNode;
  assignForm: ReactNode;
  extra?: ReactNode;
  variant?: 'full' | 'identity' | 'actions';
  includeContactFields?: boolean;
  omitKeys?: string[];
}) {
  const rows = leadPropertyRows(lead, ownerLabel, {
    includeContactFields: includeContactFields ?? variant === 'identity',
    omitKeys,
  });
  const showProfile = variant !== 'actions';
  const showActions = variant !== 'identity';
  return (
    <section
      className={`lead-property-rail${variant === 'identity' ? ' lead-property-rail--identity' : ''}`}
      data-testid="lead-property-rail"
    >
      {showProfile && variant !== 'identity' ? <h2 className="lead-property-rail__title">Thuộc tính</h2> : null}
      {showProfile ? contact : null}
      {showProfile ? (
        variant === 'identity' ? (
          <>
            <dl className="lead-identity-facts">
              {rows.map((row) => (
                <div key={row.key} className="lead-identity-facts__item">
                  <dt>{row.label}</dt>
                  <dd>
                    {row.tone ? (
                      <span className={`crm-kanban-card__chip crm-kanban-card__chip--${row.tone}`}>
                        {row.value}
                      </span>
                    ) : (
                      row.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="lead-identity-status">{statusForm}</div>
          </>
        ) : (
          <div className="lead-property-rail__line">
            <dl className="lead-property-rail__facts">
              {rows.map((row) => (
                <div key={row.key} className="lead-property-rail__fact">
                  <dt>{row.label}</dt>
                  <dd>
                    {row.tone ? (
                      <span className={`crm-kanban-card__chip crm-kanban-card__chip--${row.tone}`}>
                        {row.value}
                      </span>
                    ) : (
                      row.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="lead-property-rail__status">{statusForm}</div>
          </div>
        )
      ) : null}
      {showActions && (assignForm || extra) ? (
      <div className="lead-property-rail__line lead-property-rail__line--pair">
        {assignForm ? <div className="lead-property-rail__assign">{assignForm}</div> : null}
        {extra ? <div className="lead-property-rail__audit">{extra}</div> : null}
      </div>
      ) : null}
    </section>
  );
}
