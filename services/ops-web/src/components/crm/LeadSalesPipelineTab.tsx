'use client';

import { useMemo } from 'react';
import { LeadPipelineIntakePanel } from '@/components/crm/LeadPipelineIntakePanel';
import type { LeadRow } from '@/lib/api';
import { LeadFunnelPanel } from '@/components/LeadFunnelPanel';
import { LeadPipelineDoneAccordion } from '@/components/crm/LeadPipelineDoneAccordion';
import { LeadPipelineSlaStrip } from '@/components/crm/LeadPipelineSlaStrip';
import { resolveFunnelStepper } from '@/lib/crm/funnel-stepper.util';
import { salesSafeQuoteAction } from '@/lib/crm/sales-quote-open.util';
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
  viewerIsSales = false,
  quoteSheetVisible = false,
  lead = null,
  canEdit,
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
  /** Sales must never follow a CTA onto /crm/proposals/new (403). */
  viewerIsSales?: boolean;
  quoteSheetVisible?: boolean;
  lead?: LeadRow | null;
  canEdit?: boolean;
}) {
  const stepperVm = useMemo(() => resolveFunnelStepper(stepperInput), [stepperInput]);
  const activeState = stepperVm.steps.find((s) => s.key === activeStepKey)?.state ?? 'current';
  const viewModel = {
    ...stepperVm,
    steps: stepperVm.steps.map((s) => ({ ...s, isActive: s.key === activeStepKey })),
    activeStep: activeStepKey,
    primaryAction: salesSafeQuoteAction(stepperVm.primaryAction, {
      isSales: Boolean(viewerIsSales),
      quoteVisible: Boolean(quoteSheetVisible),
    }),
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

  const slaUseful =
    slaState === 'warning' || slaState === 'breach' || Boolean(slaCountdown && String(slaCountdown).trim());
  const discoveryStep = activeStepKey === 'intake_bant' || activeStepKey === 'presales_lead';

  return (
    <div className="lead-pipeline-tab" role="tabpanel" id="lead-pipeline-panel">
      {!onB2 && slaUseful ? (
        <LeadPipelineSlaStrip
          worstLabel={slaLabel ?? 'SLA'}
          countdown={slaCountdown ?? null}
          state={slaState ?? 'ok'}
          detail={slaDetailNode}
        />
      ) : null}
      <div className="lead-pipeline-tab__head">
        {activeStepKey === 'intake_bant' || activeStepKey === 'presales_lead' ? (
          <LeadPipelineIntakePanel
            leadId={leadId}
            token={token}
            lead={lead}
            user={user}
            canEdit={canEdit}
            serviceSlug={serviceSlug}
            intakeSummary={stepperInput.intakeSummary}
            onFunnelChange={onFunnelChange}
            onMessage={onMessage}
            onError={onError}
          />
        ) : null}
      </div>
      {discoveryStep ? null : (
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
      )}
      {discoveryStep ? null : (
      <LeadPipelineDoneAccordion steps={stepperVm.steps} onReview={onStepChange} />
      )}
    </div>
  );
}
