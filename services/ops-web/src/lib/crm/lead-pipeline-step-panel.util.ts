import type { FunnelStepState, PresalesFunnelStepKey } from '@/lib/crm/funnel-stepper.types';

export type PipelinePanelMode = 'live' | 'blocked_ahead' | 'review';

export function resolvePipelinePanelMode(
  _key: PresalesFunnelStepKey,
  state: FunnelStepState,
  inReview = false,
): PipelinePanelMode {
  if (inReview) return 'review';
  if (state === 'pending') return 'blocked_ahead';
  return 'live';
}
