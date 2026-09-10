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
