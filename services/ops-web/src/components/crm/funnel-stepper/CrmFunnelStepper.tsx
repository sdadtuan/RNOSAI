'use client';

import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';
import { CrmFunnelStepGateStrip } from '@/components/crm/funnel-stepper/CrmFunnelStepGateStrip';
import { CrmFunnelStepPrimaryAction } from '@/components/crm/funnel-stepper/CrmFunnelStepPrimaryAction';
import { CrmFunnelStepTrack } from '@/components/crm/funnel-stepper/CrmFunnelStepTrack';
import { resolveFunnelStepper } from '@/lib/crm/funnel-stepper.util';
import type {
  FunnelPrimaryAction,
  FunnelStepperContext,
  FunnelStepperInput,
  FunnelStepperViewModel,
} from '@/lib/crm/funnel-stepper.types';

export interface CrmFunnelStepperProps extends FunnelStepperInput {
  gateLoading?: boolean;
  actionBusy?: boolean;
  onRefreshGate?: () => void;
  onPrimaryAction?: (action: FunnelPrimaryAction) => void | Promise<void>;
  /** Pass pre-resolved view model to skip resolve (testing/story). */
  viewModel?: FunnelStepperViewModel;
  className?: string;
  showTitle?: boolean;
  beforeAction?: ReactNode;
  onEditBant?: () => void;
}

export function CrmFunnelStepper({
  leadId,
  funnel,
  consultGate,
  proposalGate,
  consultProposalSla,
  intakeSummary,
  solutionCaps,
  contract,
  scope,
  context,
  gateLoading,
  actionBusy,
  onRefreshGate,
  onPrimaryAction,
  viewModel: viewModelProp,
  className,
  showTitle = true,
  beforeAction,
  onEditBant,
}: CrmFunnelStepperProps) {
  const viewModel = useMemo(
    () =>
      viewModelProp ??
      resolveFunnelStepper({
        leadId,
        funnel,
        consultGate,
        proposalGate,
        consultProposalSla,
        intakeSummary,
        solutionCaps,
        contract,
        scope,
        context,
      }),
    [
      viewModelProp,
      leadId,
      funnel,
      consultGate,
      proposalGate,
      consultProposalSla,
      intakeSummary,
      solutionCaps,
      contract,
      scope,
      context,
    ],
  );

  if (!viewModel.visible) return null;

  const rootClass = [
    'crm-funnel-stepper',
    viewModel.context === 'intake' ? 'crm-funnel-stepper--intake' : '',
    viewModel.context === 'compact' ? 'crm-funnel-stepper--compact' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <nav className={rootClass} aria-label="Funnel pre-sales">
      {showTitle ? (
        <div className="crm-funnel-stepper__head">
          <h3 className="crm-funnel-stepper__title">Tiến trình Pre-sales</h3>
          <p className="crm-funnel-stepper__desc">
            B2 → Pre Sale → Tư vấn → Báo giá
          </p>
        </div>
      ) : null}

      <CrmFunnelStepTrack steps={viewModel.steps} context={viewModel.context} />

      {viewModel.inReview ? (
        <p className="crm-funnel-stepper__alert">
          Lead đang <strong>Phải tra soát</strong>. AM tạm khóa funnel — GDKD xử lý tại{' '}
          <Link href="/crm/leads/review-queue">inbox Phải tra soát</Link>.
        </p>
      ) : null}

      {viewModel.gateStrip ? (
        <CrmFunnelStepGateStrip
          leadId={leadId}
          gateStrip={viewModel.gateStrip}
          loading={gateLoading}
          onRefresh={onRefreshGate}
          onEdit={viewModel.gateStrip.gateKind === 'consult' ? onEditBant : undefined}
        />
      ) : null}

      {beforeAction}
      {!viewModel.inReview ? (
        <CrmFunnelStepPrimaryAction
          action={viewModel.primaryAction}
          secondaryAction={viewModel.secondaryAction}
          context={viewModel.context}
          busy={actionBusy}
          onAction={onPrimaryAction}
        />
      ) : null}
    </nav>
  );
}

export type { FunnelStepperContext };
