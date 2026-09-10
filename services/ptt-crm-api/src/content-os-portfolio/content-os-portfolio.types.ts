export type PortfolioRiskQueueItem = {
  item_id: number;
  lifecycle_id: number;
  content_code: string | null;
  title: string;
  client_label: string | null;
  risk_signal: string;
  owner_label: string | null;
  sla_remaining_h: number | null;
  recommended_action: string;
};

export type PortfolioCommandCenter = {
  throughput_week: number;
  completed_week: number;
  wip: number;
  sla_at_risk: number;
  sla_breached: number;
  first_pass_pct: number | null;
  capacity_pct: number | null;
  blocked: number;
  risk_queue: PortfolioRiskQueueItem[];
};

export type PortfolioCommandScope = {
  staffId?: number;
  lifecycleHint?: number;
};

export const CONTENT_REQUEST_SOURCES = ['account', 'client_portal', 'campaign', 'api', 'idea'] as const;
export type ContentRequestSource = (typeof CONTENT_REQUEST_SOURCES)[number];

export type ContentRequestRow = {
  id: number;
  lifecycle_id: number;
  display_code: string;
  kind: 'request' | 'idea';
  source: string;
  requester_email: string;
  client_label: string;
  brand_label: string;
  deliverable_ask: string;
  objective: string;
  due_at: string | null;
  priority: string;
  risk_level: string;
  completeness: number;
  effort_h: number | null;
  tier: string | null;
  triage_status: string;
  idea_id: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ContentRequestWrite = {
  lifecycle_id: number;
  display_code: string;
  source: string;
  requester_email: string;
  client_label: string;
  brand_label: string;
  deliverable_ask: string;
  objective: string;
  due_at: string | null;
  priority: string;
  completeness: number;
  triage_status: string;
  created_by: string;
};

export type ItemRequestLinkPatch = {
  request_id: number;
  display_code?: string;
};

export const PORTFOLIO_SLA_AT_RISK_HOURS = 18;

export function emptyPortfolioCommandCenter(): PortfolioCommandCenter {
  return {
    throughput_week: 0,
    completed_week: 0,
    wip: 0,
    sla_at_risk: 0,
    sla_breached: 0,
    first_pass_pct: null,
    capacity_pct: null,
    blocked: 0,
    risk_queue: [],
  };
}
