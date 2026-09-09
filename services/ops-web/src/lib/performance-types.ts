export type PmHealth = 'green' | 'yellow' | 'red' | 'no_data' | 'approved';

export type PmAssignment = {
  id: string;
  name: string;
  code: string;
  definition_code: string;
  owner: string;
  scope_type: string;
  scope_name: string;
  department: string;
  cycle: string;
  period: string;
  direction: string;
  target: number;
  target_label: string;
  actual: number | null;
  unit: string;
  progress: number | null;
  status: PmHealth;
  trend: 'up' | 'down' | 'flat' | 'na';
  source: string;
  quality: string;
  quoted_target: number | null;
  source_id: string | null;
  instance_id: string | null;
  collection_method: string;
  lifecycle: string;
  quoted_vs_assigned_pct: number | null;
  quoted_vs_actual_pct: number | null;
  quoted_delta_material: boolean;
  actual_locked: boolean;
  assumption_open: boolean;
  client_visible: boolean;
  disclaimer: string;
};

export type PmScorecardItem = {
  id: string;
  name: string;
  definition_code: string;
  weight: number;
  target_label: string;
  unit: string;
  formula: string;
  owner: string;
};

export type PmScorecard = {
  id: string;
  title: string;
  owner: string;
  department: string;
  period: string;
  cycle: string;
  approver: string;
  status: string;
  items: PmScorecardItem[];
  weight_total: number;
  weight_valid: boolean;
};

export type PmDashboard = {
  on_track: number;
  watch: number;
  off_track: number;
  total: number;
  completion_pct: number;
  checkin_on_time_pct: number;
  data_blocked: number;
  ledgers: {
    quoted: { value: number | null; label: string; hint: string };
    assigned: { value: number | null; label: string; hint: string };
    verified: { value: number | null; label: string; hint: string };
  };
  rhythm: Array<{ id: string; title: string; body: string; href: string }>;
  dept_scores: Array<{ department: string; score: number; status: PmHealth }>;
  queue: Array<{ title: string; badge: string; href: string }>;
};

export type PmCheckInBundle = {
  assignment: PmAssignment | null;
  items: Array<{
    id: string;
    assignment_id: string;
    date: string;
    author: string;
    status: PmHealth;
    note: string;
    forecast?: string;
    evidence?: string;
  }>;
  actions: Array<{ id: string; title: string; owner: string; due: string; impact: string }>;
};

export type PmMarketing = {
  spend: string;
  valid_leads: number;
  cpl: number;
  mql_rate: number;
  roas: { value: number | null; display: string; reason: string | null };
  sources: Array<{ name: string; health: string }>;
  at_risk: Array<{ title: string; actual: string; status: PmHealth }>;
};

export type PmCampaigns = {
  items: Array<{
    campaign: string;
    client: string;
    quote_wo: string;
    kpi: string;
    quoted: string;
    actual: string;
    media_budget: string;
    agency_fee: string;
    status: PmHealth;
  }>;
  funnel: Array<{ label: string; value: number | null; display: string; hint: string }>;
};

export type PmCrmSource = {
  tiles: Array<{ label: string; value: string | number; hint: string; tone?: string }>;
  mappings: Array<{
    kpi: string;
    definition: string;
    field: string;
    cadence: string;
    quality: string;
    related: string;
  }>;
};

export type PmReports = {
  completion_pct: number;
  compliance_pct: number;
  at_risk_pct: number;
  overdue_checkins: number;
  snapshots: number;
  scorecards_active: number;
  period_state: 'open' | 'closed';
  by_scope: Array<{ scope: string; healthy_pct: number; green?: number; yellow?: number; red?: number }>;
};

export type PmSettings = {
  score_cap: string;
  weight_must_100: boolean;
  green_min: number;
  yellow_min: number;
  lower_red_rule: string;
  reminder: string;
  escalation: string;
  stale_action: string;
  period_close: string;
  default_source: string;
  client_visibility: string;
  effective_at: string;
  impact: { scorecards: number; assignments: number; snapshots_untouched: boolean };
};
