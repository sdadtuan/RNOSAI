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

export type AmRole = 'am' | 'director' | 'admin';

export type AmCommandCenter = {
  period: { from: string; to: string };
  scope: AmScope;
  freshness: { as_of: string; stale: boolean; work_left_label: string | null };
  role: AmRole;
  load: { accounts: number; quota: number };
  kpis: {
    active_accounts: number | null;
    mrr_vnd: number | null;
    renewal_90d_vnd: number | null;
    renewal_90d_count: number | null;
    revenue_at_risk_vnd: number | null;
    revenue_at_risk_count: number | null;
    sla_overdue: number | null;
    csat: number | null;
    deltas?: Partial<Record<string, number>>;
  };
  coverage: null | {
    avg_load: number | null;
    unassigned: number;
    delegated: number;
    qbr_this_week: number;
  };
  today_work: Array<{
    id: string;
    due_at: string | null;
    title: string;
    account_name: string;
    sla_label: string | null;
    chip: 'overdue' | 'today' | 'soon' | 'unassigned';
    can_accept: boolean;
  }>;
  attention: Array<{
    agency_client_id: string;
    name: string;
    parent_name: string | null;
    band: AmHealthBand;
    score: number | null;
    mrr_vnd: number | null;
    days_to_end: number | null;
  }>;
  forecast: {
    committed_vnd: number | null;
    likely_vnd: number | null;
    risk_vnd: number | null;
    unlikely_vnd: number | null;
  };
  health_dist: {
    healthy: number;
    watch: number;
    at_risk: number;
    critical: number;
    avg: number | null;
  };
  my_book: Array<{
    agency_client_id: string;
    name: string;
    is_parent: boolean;
    child_count: number;
    owner_label: string;
    package_label: string;
    score: number | null;
    band: AmHealthBand | null;
    mrr_vnd: number | null;
    ends_on: string | null;
    next_action: string | null;
  }>;
};
