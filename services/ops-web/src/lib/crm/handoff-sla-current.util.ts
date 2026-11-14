import type { HandoffFlowStepKey } from '@/lib/crm/handoff-flow.util';
import type { HandoffSlaClockView } from '@/components/crm/HandoffSlaCountdown';

export const HANDOFF_STEP_CLOCK_KEYS: Record<HandoffFlowStepKey, string[]> = {
  receive_lead: ['sales_accept', 'sales_update'],
  sales_brief: ['sales_brief', 'missing_info'],
  await_solutions: ['solution_accept'],
  doing_solutions: ['solution_revision', 'solution_work'],
  await_quote: ['quote_accept', 'quote_finish', 'ceo_approve', 'customer_response'],
  negotiate: ['negotiate'],
  sign_contract: ['contract'],
};

export type HandoffSlaViewLike = {
  current?: HandoffSlaClockView | null;
  clocks?: HandoffSlaClockView[] | null;
} | null | undefined;

function isUsable(clock: HandoffSlaClockView | null | undefined): clock is HandoffSlaClockView {
  return Boolean(clock && clock.due_at && clock.state && clock.state !== 'na');
}

/** Banner/chip/stepper clock for the CURRENT flow step only. Never fall back to an earlier-step clock. */
export function pickHandoffSlaClockForStep(
  sla: HandoffSlaViewLike,
  step: HandoffFlowStepKey | string | null | undefined,
): HandoffSlaClockView | null {
  const keys = HANDOFF_STEP_CLOCK_KEYS[step as HandoffFlowStepKey] ?? [];
  if (!keys.length) return null;
  const clocks = Array.isArray(sla?.clocks) ? sla!.clocks! : [];
  const same = clocks.filter((c) => keys.includes(c.key) && isUsable(c));
  const pool = same.length ? same : isUsable(sla?.current) && keys.includes(sla!.current!.key) ? [sla!.current!] : [];
  if (!pool.length) return null;
  return pool.find((c) => c.state === 'breach') ?? pool.find((c) => c.state === 'warning') ?? pool[0];
}
