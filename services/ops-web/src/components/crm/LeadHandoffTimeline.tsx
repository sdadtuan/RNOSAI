'use client';

import type { LeadFunnelSnapshot } from '@/lib/api';
import { funnelB2Complete } from '@/lib/crm/funnel-snapshot.util';
import { HandoffFlowStepper } from '@/components/crm/am/HandoffFlowStepper';
import {
  resolveHandoffFlow,
  type HandoffFlowInput,
} from '@/lib/crm/handoff-flow.util';

/** @deprecated Old 8-step builder — kept so existing tests compile. Prefer resolveHandoffFlow. */
type StepState = 'done' | 'current' | 'pending';
type Step = { key: string; label: string; state: StepState; detail?: string };

export function funnelToHandoffInput(
  funnel: LeadFunnelSnapshot | null,
  extra?: Partial<HandoffFlowInput>,
): HandoffFlowInput {
  const handoff = funnel?.presales?.handoff as
    | {
        status?: string;
        handed_off_at?: string;
        solution_claimed_at?: string;
        solution_released_at?: string;
      }
    | undefined;
  const presales = funnel?.presales?.presales as
    | { handoff_status?: string; status?: string }
    | undefined;
  const quote = funnel?.presales?.quote_case;
  const lead = (funnel as { lead?: { status?: string; created_at?: string; received_at?: string } } | null)
    ?.lead;
  return {
    leadStatus: extra?.leadStatus ?? lead?.status ?? null,
    leadCreatedAt: extra?.leadCreatedAt ?? lead?.created_at ?? null,
    leadReceivedAt: extra?.leadReceivedAt ?? lead?.received_at ?? null,
    handoffStatus: handoff?.status ?? presales?.handoff_status ?? extra?.handoffStatus ?? null,
    handedOffAt: handoff?.handed_off_at ?? extra?.handedOffAt ?? null,
    solutionClaimedAt: handoff?.solution_claimed_at ?? extra?.solutionClaimedAt ?? null,
    solutionReleasedAt: handoff?.solution_released_at ?? extra?.solutionReleasedAt ?? null,
    quotePhase: quote?.phase ?? extra?.quotePhase ?? null,
    discoverySubmitted:
      extra?.discoverySubmitted ??
      (handoff?.status === 'pending' ||
        handoff?.status === 'with_solution' ||
        handoff?.status === 'released' ||
        handoff?.status === 'returned'),
    discoverySubmittedAt: extra?.discoverySubmittedAt ?? handoff?.handed_off_at ?? null,
    returnedToSales: extra?.returnedToSales ?? handoff?.status === 'returned',
    hasContract: extra?.hasContract,
    contractStatus: extra?.contractStatus,
    firstContactDone: extra?.firstContactDone ?? funnelB2Complete(funnel),
  };
}

/** Legacy helper used by older tests — maps the 7-step flow into the old shape. */
export function buildLeadHandoffSteps(funnel: LeadFunnelSnapshot | null): Step[] {
  const view = resolveHandoffFlow(funnelToHandoffInput(funnel));
  return view.steps.map((step) => ({
    key: step.key,
    label: step.label,
    state: step.state,
    detail: step.hint || undefined,
  }));
}

export function LeadHandoffTimeline({
  funnel,
  leadStatus,
  leadCreatedAt,
  leadReceivedAt,
}: {
  funnel: LeadFunnelSnapshot | null;
  leadStatus?: string | null;
  leadCreatedAt?: string | null;
  leadReceivedAt?: string | null;
}) {
  const view = resolveHandoffFlow(
    funnelToHandoffInput(funnel, { leadStatus, leadCreatedAt, leadReceivedAt }),
  );

  return (
    <nav aria-label="Tiến độ bàn giao" className="lead-handoff-timeline" data-testid="lead-handoff-timeline">
      <HandoffFlowStepper view={view} />
    </nav>
  );
}
