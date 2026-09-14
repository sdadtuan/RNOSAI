import type { LeadFlowKind } from '../leads-funnel/lead-flow-kind.util';

export type LeadLevelTier = {
  id: string;
  label: string;
  emoji: string;
  description: string;
  sla_label: string;
  min_score: number;
  max_score: number;
  enabled: boolean;
  sort_order: number;
};

export type LeadRoutingRule = {
  id: string;
  label: string;
  channel: string;
  source: string;
  requires_client: boolean | null;
  flow_kind: LeadFlowKind;
  priority: number;
  enabled: boolean;
};

export type LeadFlowClassificationProfile = {
  level_tiers: LeadLevelTier[];
  default_inbound_score: number;
};

export type LeadClassificationConfig = {
  default_flow_kind: LeadFlowKind;
  flows: Record<LeadFlowKind, LeadFlowClassificationProfile>;
  routing_rules: LeadRoutingRule[];
};

export type UpdateLeadClassificationBody = Partial<LeadClassificationConfig>;
