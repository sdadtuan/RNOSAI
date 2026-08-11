import type { ProposalAdvanceGate } from '../leads-funnel/presales-proposal-gate.util';
import type { PresalesSnapshot } from '../leads-funnel/leads-funnel.types';

export interface DealRoomGateChip {
  key: string;
  label: string;
  status: 'ok' | 'warn' | 'block' | 'pending';
  message: string;
}

export interface DealRoomGates {
  g0_b2: DealRoomGateChip;
  g1_consult: DealRoomGateChip;
  g4_r5: DealRoomGateChip;
  g5_proposal: DealRoomGateChip;
  g6_accept: DealRoomGateChip;
}

export interface DealRoomMarketingPlanView {
  name: string;
  north_star: string;
  objectives: string;
  strategy_framework: Record<string, string>;
  validation_ok: boolean;
  validation_messages: string[];
}

export interface L1GateChecklistItemView {
  key: string;
  label: string;
  done: boolean;
}

export interface DealRoomQuoteTierView {
  tier: string;
  tier_label: string;
  total_vnd: number | null;
  reference_min_vnd: number | null;
  reference_max_vnd: number | null;
  is_reference: boolean;
}

export interface DealRoomQuoteView {
  proposal_id: number | null;
  status: string | null;
  total_vnd: number | null;
  customer_id: number | null;
  presales_id: number | null;
  service_slug: string;
  tiers: DealRoomQuoteTierView[];
  can_create: boolean;
  block_reason: string;
}

export interface DealRoomActionsView {
  can_export_pack: boolean;
  can_share_teaser: boolean;
  proposals_href: string;
}

export interface DealRoomSnapshot {
  ok: true;
  lead_id: number;
  lead_name: string;
  lead_flow_kind: string;
  owner_id: number | null;
  owner_name: string | null;
  presales: PresalesSnapshot;
  gates: DealRoomGates;
  marketing_plan: DealRoomMarketingPlanView;
  consult_progress: { done: number; total: number };
  quote: DealRoomQuoteView;
  actions: DealRoomActionsView;
  proposal_gate: ProposalAdvanceGate;
  l1_checklist: L1GateChecklistItemView[];
}
