'use client';

import Link from 'next/link';
import type { LeadFunnelSnapshot } from '@/lib/api';
import type { LeadContractFlowSummary } from '@/lib/crm/lead-contract-flow';
import { resolveLeadJourney, showDeliverySpine } from '@/lib/crm/lead-journey';

type Props = {
  leadId: number;
  funnel: LeadFunnelSnapshot | null;
  contract?: LeadContractFlowSummary | null;
  onOpenConsult?: () => void;
};

const DESC_PRE_WON = 'B2 → Pre-sales → Intake → Tư vấn → Báo giá → HĐ';
const DESC_POST_WON = 'B2 → … → HĐ → OB → Giao → CL → Ret';

export function LeadJourneyStepper({ leadId, funnel, contract, onOpenConsult }: Props) {
  const journeyInput = {
    reviewActive: Boolean(funnel?.review_queue.active),
    b2Complete: Boolean(funnel?.care_pipeline.all_complete),
    presalesStage: funnel?.presales?.presales.stage ?? null,
    hasContract: Boolean(contract?.hasContract || contract?.pendingApproval),
    contractActive: contract?.contractStatus === 'active',
    lifecycleId: contract?.lifecycleId ?? null,
    lifecycleStage: contract?.lifecycleStage ?? null,
    agencyClientId: contract?.agencyClientId ?? null,
    leadId,
    serviceSlug: funnel?.presales?.presales.service_slug ?? null,
  };
  const steps = resolveLeadJourney(journeyInput);
  const extended = showDeliverySpine(journeyInput);

  return (
    <nav aria-label="Hành trình B2B" className="lead-journey" data-testid="lead-journey">
      <div className="lead-journey__head">
        <h3 className="lead-journey__title">Hành trình</h3>
        <p className="lead-journey__desc">{extended ? DESC_POST_WON : DESC_PRE_WON}</p>
      </div>
      <ol className={`lead-journey__track${extended ? ' lead-journey__track--extended' : ''}`}>
        {steps.map((step, idx) => {
          const inner = (
            <>
              <span className="lead-journey__dot" aria-hidden>
                {step.state === 'done' ? '✓' : idx + 1}
              </span>
              <span className="lead-journey__label">{step.label_vi}</span>
              <span className="lead-journey__label-short" title={step.label_vi}>
                {step.short_vi}
              </span>
            </>
          );
          return (
            <li key={step.key} className={`lead-journey__step lead-journey__step--${step.state}`}>
              {step.key === 'consult' && onOpenConsult ? (
                <button type="button" className="lead-journey__link" onClick={onOpenConsult}>
                  {inner}
                </button>
              ) : step.href ? (
                <Link href={step.href} className="lead-journey__link">
                  {inner}
                </Link>
              ) : step.anchor ? (
                <a href={step.anchor} className="lead-journey__link">
                  {inner}
                </a>
              ) : (
                <span className="lead-journey__link lead-journey__link--muted">{inner}</span>
              )}
              {idx < steps.length - 1 ? <span className="lead-journey__line" aria-hidden /> : null}
            </li>
          );
        })}
      </ol>
      {funnel?.review_queue.active ? (
        <p className="lead-journey__alert">
          Lead đang phải tra soát.{' '}
          <Link href="/crm/leads/review-queue">Mở inbox</Link>
        </p>
      ) : null}
    </nav>
  );
}
