'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { CrmFunnelStepper } from '@/components/crm/funnel-stepper';
import { bantDetailHref, LeadPipelineIntakePanel } from '@/components/crm/LeadPipelineIntakePanel';
import { LeadFunnelPanel } from '@/components/LeadFunnelPanel';
import { LeadPipelineDoneAccordion } from '@/components/crm/LeadPipelineDoneAccordion';
import { LeadPipelineSlaStrip } from '@/components/crm/LeadPipelineSlaStrip';
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
  actionBusy,
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
  slaLabel,
  slaCountdown,
  slaState,
  slaDetail,
  leadStatus = null,
}: {
  token: string;
  leadId: number;
  user: StoredStaffUser | null;
  stepperInput: FunnelStepperInput;
  activeStepKey: PresalesFunnelStepKey;
  onStepChange: (key: PresalesFunnelStepKey) => void;
  onFunnelPrimaryAction?: (action: FunnelPrimaryAction) => void | Promise<void>;
  actionBusy?: boolean;
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
  onIntakeSaved?: () => void;
  hideM1Card?: boolean;
  showPresalesBlock?: boolean;
  highlightAfterCall?: boolean;
  readOnly?: boolean;
  slaLabel?: string;
  slaCountdown?: string | null;
  slaState?: 'ok' | 'warning' | 'breach';
  slaDetail?: string | null;
  /** CRM lead status. Hides receive-SLA controls once the lead is at Tư vấn. */
  leadStatus?: string | null;
}) {
  const router = useRouter();
  const stepperVm = useMemo(() => resolveFunnelStepper(stepperInput), [stepperInput]);
  const activeState = stepperVm.steps.find((s) => s.key === activeStepKey)?.state ?? 'current';
  const viewModel = {
    ...stepperVm,
    steps: stepperVm.steps.map((s) => ({ ...s, isActive: s.key === activeStepKey })),
    activeStep: activeStepKey,
  };
  const onB2 = activeStepKey === 'b2';
  const slaDetailNode = onB2 ? (
    <div className="lead-pipeline-sla__fr-note">
      <p>
        <strong>Phản hồi đầu (SLA)</strong> nằm trong bước <strong>Liên hệ lần đầu</strong> bên
        dưới — lần gọi điện thoại đầu sau khi giao lead.
      </p>
      {slaDetail ? <p className="muted">{slaDetail}</p> : null}
    </div>
  ) : slaDetail ? (
    <p>{slaDetail}</p>
  ) : (
    <p className="muted">Không có chi tiết SLA.</p>
  );

  return (
    <div className="lead-pipeline-tab" role="tabpanel" id="lead-pipeline-panel">
      {onB2 ? null : (
        <LeadPipelineSlaStrip
          worstLabel={slaLabel ?? 'SLA'}
          countdown={slaCountdown ?? null}
          state={slaState ?? 'ok'}
          detail={slaDetailNode}
        />
      )}
      <div className="lead-pipeline-tab__head">
        <span className="lead-zone__kicker">Bước pipeline</span>
        <CrmFunnelStepper
          {...stepperInput}
          viewModel={viewModel}
          showTitle={false}
          actionBusy={actionBusy}
          onPrimaryAction={readOnly ? undefined : onFunnelPrimaryAction}
          onEditBant={
            readOnly
              ? undefined
              : () => {
                  const summary = stepperInput.intakeSummary;
                  const sessionId = summary?.preview?.id ?? summary?.latest_completed?.id;
                  router.push(bantDetailHref(leadId, sessionId, serviceSlug));
                }
          }
          beforeAction={
            activeStepKey === 'intake_bant' &&
            (stepperInput.intakeSummary?.preview || stepperInput.intakeSummary?.latest_completed) ? (
              <LeadPipelineIntakePanel
                leadId={leadId}
                serviceSlug={serviceSlug}
                intakeSummary={stepperInput.intakeSummary}
              />
            ) : null
          }
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
        onStepChange={onStepChange}
        leadStatus={leadStatus}
      />
      <LeadPipelineDoneAccordion steps={stepperVm.steps} onReview={onStepChange} />
    </div>
  );
}
