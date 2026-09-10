import { API_BASE } from '@/lib/api';

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

export type PortfolioCommandCenterInsight = {
  status: string;
  title?: string | null;
  body?: string | null;
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
  insight?: PortfolioCommandCenterInsight | null;
};

export async function fetchCommandCenter(token: string): Promise<PortfolioCommandCenter> {
  const res = await fetch(`${API_BASE}/api/crm/content-os/portfolio/command-center`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Không tải được Command Center');
  return res.json();
}
