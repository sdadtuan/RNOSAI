export type CpScope = 'me' | 'team' | 'all';

export type CpKpis = {
  videos_created: number | null;
  videos_approved: number | null;
  render_success_rate: number | null;
  render_avg_duration_sec: number | null;
  credits_used: number | null;
  credits_remaining: number | null;
  assets_expiring: number | null;
  tasks_overdue: number | null;
};

export type RenderGateInput = {
  aiEnabled: boolean;
  hasRenderCap: boolean;
  assetState: string | null;
  rightsExpired: boolean;
  creditBlocked: boolean;
  moderationBlocked: boolean;
  qcStatus: string | null;
};

export function emptyKpis(): CpKpis {
  return {
    videos_created: null,
    videos_approved: null,
    render_success_rate: null,
    render_avg_duration_sec: null,
    credits_used: null,
    credits_remaining: null,
    assets_expiring: null,
    tasks_overdue: null,
  };
}
