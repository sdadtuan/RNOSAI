'use client';

import {
  REVOPS_ROUTING_WATERFALL,
  REVOPS_SLA_ESCALATION_TIMELINE,
} from '@/lib/crm/leads-inbox-revops.util';

export function LeadsRevopsInboxFooter() {
  return (
    <div className="revops-grid-2 revops-section leads-revops-footer" data-testid="leads-revops-footer">
      <section className="revops-card revops-card--panel">
        <header className="revops-card__head">
          <h3>Routing waterfall</h3>
          <span className="revops-tag revops-tag--gray">Static W2</span>
        </header>
        <ol className="leads-revops-steps">
          {REVOPS_ROUTING_WATERFALL.map((step) => (
            <li key={step.step}>
              <b>
                {step.step}. {step.title}
              </b>
              <span>{step.detail}</span>
            </li>
          ))}
        </ol>
      </section>
      <section className="revops-card revops-card--panel">
        <header className="revops-card__head">
          <h3>SLA escalation timeline</h3>
          <span className="revops-tag revops-tag--gray">Simulate W3</span>
        </header>
        <ol className="leads-revops-steps">
          {REVOPS_SLA_ESCALATION_TIMELINE.map((item) => (
            <li key={item.at}>
              <b>
                {item.at} — {item.label}
              </b>
              <span>{item.detail}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
