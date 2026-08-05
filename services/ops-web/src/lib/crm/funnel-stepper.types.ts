import type { LeadFunnelSnapshot } from '@/lib/api';

export interface LeadContractFlowSummary {
  hasContract: boolean;
  contractStatus: string | null;
  pendingApproval: boolean;
  lifecycleId: number | null;
}

export type FunnelStepState = 'done' | 'current' | 'pending' | 'blocked' | 'warn';

export type FunnelStepperScope = 'presales' | 'full_b2b';

export type FunnelStepperContext = 'lead_detail' | 'intake' | 'compact';

export type PresalesFunnelStepKey =
  | 'b2'
  | 'presales_lead'
  | 'intake_bant'
  | 'consult'
  | 'proposal';

export interface ConsultGateState {
  ok: boolean;
  level: string;
  messages: string[];
  requires_confirm: boolean;
  requires_override: boolean;
  bant_total?: number;
  decision?: string;
}

export interface IntakeStepSummary {
  has_draft: boolean;
  latest_completed?: {
    id: number;
    decision: string;
    bant_total: number;
    completed_at: string;
  };
}

export interface FunnelStepperInput {
  leadId: number;
  funnel: LeadFunnelSnapshot | null;
  consultGate: ConsultGateState | null;
  intakeSummary?: IntakeStepSummary | null;
  contract?: LeadContractFlowSummary | null;
  scope?: FunnelStepperScope;
  context: FunnelStepperContext;
}

export interface FunnelStepDefinition {
  key: PresalesFunnelStepKey;
  label: string;
  shortLabel: string;
  href?: string;
  anchor?: string;
}

export interface FunnelStepViewModel extends FunnelStepDefinition {
  state: FunnelStepState;
  isActive: boolean;
}

export type FunnelPrimaryActionKind =
  | 'none'
  | 'anchor'
  | 'link'
  | 'advance_presales'
  | 'ensure_presales'
  | 'create_intake_session'
  | 'focus_intake_form';

export interface FunnelPrimaryAction {
  kind: FunnelPrimaryActionKind;
  label: string;
  disabled: boolean;
  blockReason?: string;
  requiresConfirm?: boolean;
  requiresOverride?: boolean;
  href?: string;
  anchor?: string;
}

export interface FunnelGateStripViewModel {
  tone: 'ok' | 'warn' | 'block';
  title: string;
  messages: string[];
  bantTotal?: number;
  decision?: string;
  requiresConfirm?: boolean;
  requiresOverride?: boolean;
}

export interface FunnelStepperViewModel {
  visible: boolean;
  scope: FunnelStepperScope;
  context: FunnelStepperContext;
  steps: FunnelStepViewModel[];
  activeStep: PresalesFunnelStepKey | null;
  gateStrip: FunnelGateStripViewModel | null;
  primaryAction: FunnelPrimaryAction | null;
  inReview: boolean;
}
