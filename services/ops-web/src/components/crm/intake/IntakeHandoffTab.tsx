'use client';

import { CrmFunnelStepper } from '@/components/crm/funnel-stepper';
import { IntakeAiSummaryPanel } from '@/components/crm/intake/IntakeAiSummaryPanel';
import { IntakeCommitmentsSection } from '@/components/crm/intake/IntakeCommitmentsSection';
import { IntakeStakeholderMatrix } from '@/components/crm/intake/IntakeStakeholderMatrix';
import type { ConsultGateState, FunnelPrimaryAction, IntakeStepSummary } from '@/lib/crm/funnel-stepper.types';
import type { LeadFunnelSnapshot } from '@/lib/api';
import { GO_THRESHOLDS } from '@/lib/crm/intake-bant';
import type { IntakeCommitmentRow } from '@/lib/crm/intake-commitments';
import type { IntakeStakeholderRow } from '@/lib/crm/intake-stakeholders';

type L2DocItem = { key: string; label: string; checked: boolean };

function parseL2Docs(docs: unknown): L2DocItem[] {
  if (!Array.isArray(docs)) return [];
  const items: L2DocItem[] = [];
  for (const raw of docs) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const key = typeof row.key === 'string' ? row.key : '';
    const label = typeof row.label === 'string' ? row.label : key;
    if (!key && !label) continue;
    items.push({
      key: key || label,
      label: label || key,
      checked: row.checked === true,
    });
  }
  return items;
}

export type IntakeHandoffTabProps = {
  stakeholders: IntakeStakeholderRow[];
  commitments: IntakeCommitmentRow[];
  liveBantTotal: number;
  disabled: boolean;
  aiSummary: string;
  aiBusy: boolean;
  canGenerateAi: boolean;
  l2Docs: unknown;
  leadId: number;
  funnelCollapsed: boolean;
  funnel: LeadFunnelSnapshot | null;
  consultGate: ConsultGateState | null;
  intakeSummary: IntakeStepSummary;
  gateLoading: boolean;
  actionBusy: boolean;
  onStakeholderChange: (index: number, patch: Partial<IntakeStakeholderRow>) => void;
  onCommitmentChange: (index: number, patch: Partial<IntakeCommitmentRow>) => void;
  onAiGenerate: () => void;
  onRefreshGate: () => void;
  onPrimaryAction: (action: FunnelPrimaryAction) => void;
};

export function IntakeHandoffTab({
  stakeholders,
  commitments,
  liveBantTotal,
  disabled,
  aiSummary,
  aiBusy,
  canGenerateAi,
  l2Docs,
  leadId,
  funnelCollapsed,
  funnel,
  consultGate,
  intakeSummary,
  gateLoading,
  actionBusy,
  onStakeholderChange,
  onCommitmentChange,
  onAiGenerate,
  onRefreshGate,
  onPrimaryAction,
}: IntakeHandoffTabProps) {
  const l2Items = parseL2Docs(l2Docs);

  return (
    <>
      <IntakeStakeholderMatrix
        rows={stakeholders}
        disabled={disabled}
        defaultOpen={liveBantTotal >= GO_THRESHOLDS.nurture_min}
        onChange={onStakeholderChange}
      />
      <IntakeCommitmentsSection
        rows={commitments}
        disabled={disabled}
        onChange={onCommitmentChange}
      />

      <section className="intake-l2-preview stack-gap" aria-label="L2 tài liệu">
        <header className="intake-form__head">
          <h2 className="intake-form__title">L2 tài liệu</h2>
        </header>
        {l2Items.length === 0 ? (
          <p className="muted">Tick L2 trên lead</p>
        ) : (
          <ul className="intake-red-flags-section__list">
            {l2Items.map((item) => (
              <li key={item.key}>
                <label className="intake-red-flags-section__item">
                  <input type="checkbox" checked={item.checked} disabled readOnly />
                  <span>{item.label}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <IntakeAiSummaryPanel
        summary={aiSummary}
        disabled={disabled || aiBusy}
        busy={aiBusy}
        canGenerate={canGenerateAi}
        onGenerate={onAiGenerate}
      />

      {leadId > 0 && funnelCollapsed ? (
        <details className="intake-handoff-stepper">
          <summary>Funnel stepper</summary>
          <CrmFunnelStepper
            leadId={leadId}
            funnel={funnel}
            consultGate={consultGate}
            intakeSummary={intakeSummary}
            context="intake"
            gateLoading={gateLoading}
            actionBusy={actionBusy}
            onRefreshGate={onRefreshGate}
            onPrimaryAction={onPrimaryAction}
          />
        </details>
      ) : null}
    </>
  );
}
