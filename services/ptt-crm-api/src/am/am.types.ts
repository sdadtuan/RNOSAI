export type AmHealthBand = 'healthy' | 'watch' | 'at_risk' | 'critical';
export type AmScope = 'me' | 'team' | 'all';
export type AmAmStatus =
  | 'pending_handover'
  | 'onboarding'
  | 'active'
  | 'at_risk'
  | 'renewing'
  | 'paused'
  | 'churned';
export type AmTaskKind =
  | 'task'
  | 'client_request'
  | 'issue'
  | 'escalation'
  | 'approval'
  | 'milestone';
export type AmTaskStatus =
  | 'new'
  | 'in_progress'
  | 'waiting_client'
  | 'waiting_internal'
  | 'resolved'
  | 'closed'
  | 'cancelled';
export type AmPlanKind = 'care' | 'qbr' | 'renewal' | 'expand';

export const ACTIVE_BOOK: AmAmStatus[] = ['onboarding', 'active', 'at_risk', 'renewing', 'paused'];

export type AmHealthComponents = {
  kpi_delivery: number;
  engagement: number;
  financial: number;
  satisfaction: number;
  contract_support: number;
};

export const DEFAULT_WEIGHTS: AmHealthComponents = {
  kpi_delivery: 30,
  engagement: 20,
  financial: 20,
  satisfaction: 15,
  contract_support: 15,
};
