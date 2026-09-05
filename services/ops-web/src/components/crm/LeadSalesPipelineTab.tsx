'use client';

import { useMemo } from 'react';
import { CrmFunnelStepper } from '@/components/crm/funnel-stepper';
import { LeadFunnelPanel } from '@/components/LeadFunnelPanel';
import { LeadPipelineDoneAccordion } from '@/components/crm/LeadPipelineDoneAccordion';
import { resolveFunnelStepper } from '@/lib/crm/funnel-stepper.util';
import type {
  FunnelPrimaryAction,
  FunnelStepperInput,
  PresalesFunnelStepKey,
} from '@/lib/crm/funnel-stepper.types';
import type { StoredStaffUser } from '@/lib/auth';
import type { LeadFunnelSnapshot } from '@/lib/api';

export function LeadSalesPipelineTab({
  token,
  leadId,
  user,
  stepperInput,
  activeStepKey,
  onStepChange,
  onFunnelPrimaryAction,
  serviceSlug,
  serviceOptions,
  syncFunnel,
  fetchOnMount,
  onOpenConsultTab,
  onOpenMeetingPrepTab,
  onMessage,
  onError,
  onFunnelChange,
  onFunnelUpdated,
  hideM1Card,
  showPresalesBlock,
  highlightAfterCall,
  readOnly,
}: {
  token: string;
  leadId: number;
  user: StoredStaffUser | null;
  stepperInput: FunnelStepperInput;
  activeStepKey: PresalesFunnelStepKey;
  onStepChange: (key: PresalesFunnelStepKey) => void;
  onFunnelPrimaryAction?: (action: FunnelPrimaryAction) => void | Promise<void>;
  serviceSlug?: string;
  serviceOptions?: Array<{ slug: string; name: string }>;
  syncFunnel?: LeadFunnelSnapshot | null;
  fetchOnMount?: boolean;
  onOpenConsultTab?: () => void;
  onOpenMeetingPrepTab?: () => void;
  onMessage?: (msg: string) => void;
  onError?: (msg: string) => void;
  onFunnelChange?: (funnel: LeadFunnelSnapshot) => void;
  onFunnelUpdated?: () => void;
  hideM1Card?: boolean;
  showPresalesBlock?: boolean;
  highlightAfterCall?: boolean;
  readOnly?: boolean;
}) {
  const stepperVm = useMemo(() => resolveFunnelStepper(stepperInput), [stepperInput]);
  const activeState = stepperVm.steps.find((s) => s.key === activeStepKey)?.state ?? 'current';
  const viewModel = {
    ...stepperVm,
    steps: stepperVm.steps.map((s) => ({ ...s, isActive: s.key === activeStepKey })),
    activeStep: activeStepKey,
  };

  return (
    <div className="lead-pipeline-tab" role="tabpanel" id="lead-pipeline-panel">
      <div className="lead-pipeline-sla" data-stub="a5" />
      <div className="lead-pipeline-tab__head">
        <CrmFunnelStepper
          {...stepperInput}
          viewModel={viewModel}
          showTitle={false}
          onPrimaryAction={readOnly ? undefined : onFunnelPrimaryAction}
        />
      </div>
      <LeadFunnelPanel
        token={token}
        leadId={leadId}
        user={user}
        serviceSlug={serviceSlug}
        serviceOptions={serviceOptions}
        syncFunnel={syncFunnel}
        fetchOnMount={fetchOnMount}
        onOpenConsultTab={onOpenConsultTab}
        onOpenMeetingPrepTab={onOpenMeetingPrepTab}
        onMessage={onMessage}
        onError={onError}
        onFunnelChange={onFunnelChange}
        onFunnelUpdated={onFunnelUpdated}
        hideM1Card={hideM1Card}
        showPresalesBlock={showPresalesBlock}
        highlightAfterCall={highlightAfterCall}
        layout="pipeline"
        activeStepKey={activeStepKey}
        activeStepState={activeState}
        intakeSummary={stepperInput.intakeSummary}
      />
      <LeadPipelineDoneAccordion steps={stepperVm.steps} onReview={onStepChange} />
    </div>
  );
}
