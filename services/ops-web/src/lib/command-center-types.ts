export type CommandPersona = 'executive' | 'marketing' | 'sales';

export type CommandTile = {
  code: string;
  name: string;
  actual: number | null;
  formatted: string;
  target: number | null;
  status: string;
  delta_pct: number | null;
  sparkline: number[];
  freshness: string;
};

export type CommandCenterResponse = {
  persona: CommandPersona;
  period: { from: string; to: string; timezone: 'Asia/Ho_Chi_Minh'; compare: boolean };
  tiles: CommandTile[];
  series: {
    actual: Array<{ date: string; value: number | null }>;
    target: Array<{ date: string; value: number | null }>;
    forecast: null;
  };
  at_risk: Array<{
    id: string;
    severity: string;
    kpi_code: string;
    name: string;
    scope: string;
    actual: number | null;
    target: number | null;
    owner: string | null;
    sla_hours: number | null;
  }>;
  funnel: {
    stages: Array<{
      code: string;
      name: string;
      value: number | null;
      conversion_from_prev: number | null;
    }>;
    bottleneck: { code: string; label: string };
  };
  trust: {
    score: number | null;
    sources: Array<{ system: string; status: string; last_success_at: string | null }>;
  };
  approvals: {
    kpi_count: number;
    target_count: number;
    mapping_count: number;
    recent: Array<{ id: string; kind: string; label: string }>;
  };
  exceptions: Array<{
    id: string;
    priority: string;
    object: string;
    issue: string;
    impact: string;
    owner: string | null;
    sla: string | null;
    status: string;
  }>;
  marketing?: {
    spend_series: Array<{ date: string; spend: number | null; valid_leads: number | null; cpl_target: number | null }>;
    channels: Array<{ channel: string; pct: number | null; spend: number | null; cpl: number | null }>;
    campaigns: Array<Record<string, unknown>>;
    creatives: Array<Record<string, unknown>>;
    insight: string | null;
    grain: { adset: boolean; creative: boolean; landing: boolean };
  };
  sales?: {
    pipeline_stacks: Array<{ stage: string; amount: number | null }>;
    sla: {
      actual_minutes: number | null;
      target_minutes: number;
      buckets: Record<string, number>;
      overdue_count: number;
    };
    team_rows: Array<Record<string, unknown>>;
    deals_at_risk: Array<{ id: string; name: string; amount: number | null; flags: string[]; href: string }>;
    weighted_badge: 'weighted' | 'unweighted';
  };
};

export type CommandCenterQuery = {
  from?: string;
  to?: string;
  compare?: boolean;
  department_id?: string;
  channel?: string;
  product?: string;
  team_id?: string;
};

export const EMPTY_COMMAND_CENTER: CommandCenterResponse = {
  persona: 'executive',
  period: { from: '', to: '', timezone: 'Asia/Ho_Chi_Minh', compare: false },
  tiles: [],
  series: { actual: [], target: [], forecast: null },
  at_risk: [],
  funnel: { stages: [], bottleneck: { code: '', label: '' } },
  trust: { score: null, sources: [] },
  approvals: { kpi_count: 0, target_count: 0, mapping_count: 0, recent: [] },
  exceptions: [],
};
