'use client';

import type { ReactNode } from 'react';
import { resolvePipelinePanelMode } from '@/lib/crm/lead-pipeline-step-panel.util';
import type { FunnelStepState, PresalesFunnelStepKey } from '@/lib/crm/funnel-stepper.types';

export function LeadPipelineStepPanel({
  activeStepKey,
  stepState,
  inReview,
  reviewBanner,
  b2,
  presalesLead,
  intake,
  consult,
  proposal,
}: {
  activeStepKey: PresalesFunnelStepKey;
  stepState: FunnelStepState;
  inReview: boolean;
  reviewBanner?: ReactNode;
  b2: ReactNode;
  presalesLead: ReactNode;
  intake: ReactNode;
  consult: ReactNode;
  proposal: ReactNode;
}) {
  const mode = resolvePipelinePanelMode(activeStepKey, stepState, inReview);
  if (mode === 'review') {
    return <div className="lead-pipeline-step-panel">{reviewBanner}</div>;
  }
  if (mode === 'blocked_ahead') {
    return (
      <div className="lead-pipeline-step-panel">
        <p className="muted">Hoàn thành các bước trước.</p>
      </div>
    );
  }

  const live =
    activeStepKey === 'b2'
      ? b2
      : activeStepKey === 'presales_lead'
        ? presalesLead
        : activeStepKey === 'intake_bant'
          ? intake
          : activeStepKey === 'consult'
            ? consult
            : proposal;

  return <div className="lead-pipeline-step-panel">{live}</div>;
}
