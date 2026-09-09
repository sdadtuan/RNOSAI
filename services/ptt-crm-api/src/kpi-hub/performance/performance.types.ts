import type { HealthStatus, KpiDirection } from './performance-score';

export type LedgerQuality = 'verified' | 'pending' | 'stale';
export type CollectionMethod = 'manual' | 'api' | 'connector';
export type AssignmentLifecycle = 'draft' | 'active' | 'tracking' | 'closed';
export type ReviewState = 'submitted' | 'approved' | 'returned' | 'escalated';
export type PmScopeType =
  | 'individual'
  | 'team'
  | 'department'
  | 'project'
  | 'client'
  | 'campaign'
  | 'service';
export type PmViewerRole =
  | 'owner'
  | 'lead'
  | 'dept_head'
  | 'finance'
  | 'hr'
  | 'account'
  | 'data_owner'
  | 'auditor'
  | 'client_viewer';
export type GateId = 'definition' | 'owner' | 'band' | 'source' | 'visibility';
export type GateStatus = 'pass' | 'pending' | 'fail';

export type LedgerCell = { value: number | null; label: 'Quoted' | 'Assigned' | 'Verified' | 'Pending' };
export type ThreeLedgers = { quoted: LedgerCell; assigned: LedgerCell; verified: LedgerCell };

export type ReadinessGate = { id: GateId; status: GateStatus; detail: string };
export type ReadinessResult = { gates: ReadinessGate[]; can_activate: boolean };

export type PmNotifyEvent = {
  type:
    | 'assignment_activated'
    | 'checkin_due'
    | 'checkin_overdue'
    | 'health_yellow'
    | 'health_red'
    | 'quality_stale'
    | 'action_due'
    | 'scorecard_pending'
    | 'period_closed';
  audience: string[];
  severity: 'info' | 'high' | 'critical';
  href: string;
  title: string;
};

export type PmAssignment = {
  id: string;
  name: string;
  code: string;
  definition_code: string;
  owner: string;
  scope_type: PmScopeType;
  scope_name: string;
  department: string;
  cycle: string;
  period: string;
  direction: KpiDirection;
  target: number;
  target_label: string;
  actual: number | null;
  unit: string;
  progress: number | null;
  status: HealthStatus;
  trend: 'up' | 'down' | 'flat' | 'na';
  source: string;
  quality: LedgerQuality;
  quoted_target: number | null;
  assigned_target: number;
  source_id: string | null;
  instance_id: string | null;
  collection_method: CollectionMethod;
  lifecycle: AssignmentLifecycle;
  client_visible: boolean;
  disclaimer: string;
  assumption_open: boolean;
  target_min: number | null;
  target_stretch: number | null;
  quoted_vs_assigned_pct: number | null;
  quoted_vs_actual_pct: number | null;
  quoted_delta_material: boolean;
  actual_locked: boolean;
  row_version: number;
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
  status: 'draft' | 'pending' | 'active' | 'closed';
  items: PmScorecardItem[];
  weight_total: number;
  weight_valid: boolean;
};

export type PmCheckIn = {
  id: string;
  assignment_id: string;
  date: string;
  author: string;
  status: HealthStatus | 'approved';
  note: string;
  forecast?: string;
  evidence?: string;
  review_state?: ReviewState;
  review_comment?: string;
};

export type PmCorrectiveAction = {
  id: string;
  assignment_id: string;
  title: string;
  owner: string;
  due: string;
  impact: string;
};

export type PmCampaignRow = {
  campaign: string;
  client: string;
  quote_wo: string;
  kpi: string;
  quoted: string;
  actual: string;
  media_budget: string;
  agency_fee: string;
  status: HealthStatus;
};

export type PmCrmMapping = {
  kpi: string;
  definition: string;
  field: string;
  cadence: string;
  quality: string;
  related: string;
};

export type PmSettings = {
  score_cap: '100' | '120';
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
  dept_scores: Array<{ department: string; score: number; status: HealthStatus }>;
  queue: Array<{ title: string; badge: string; href: string }>;
};

export type PmMarketing = {
  spend: string;
  valid_leads: number;
  cpl: number;
  mql_rate: number;
  roas: { value: number | null; display: string; reason: string | null };
  attribution_ready: boolean;
  sources: Array<{ name: string; health: string }>;
  at_risk: Array<{ title: string; actual: string; status: HealthStatus }>;
};

export type PmSnapshot = {
  id: string;
  scorecard_id: string;
  period_label: string;
  hash: string;
  payload: unknown;
  closed_at: string;
};

export type PmAuditLog = {
  id: string;
  actor: string;
  action: string;
  entity: string;
  payload_json: unknown;
  created_at: string;
};

export type PmCatalog = {
  dashboard: PmDashboard;
  assignments: PmAssignment[];
  scorecards: PmScorecard[];
  checkins: PmCheckIn[];
  actions: PmCorrectiveAction[];
  campaigns: PmCampaignRow[];
  crm_mappings: PmCrmMapping[];
  settings: PmSettings;
  marketing: PmMarketing;
  reports: {
    completion_pct: number;
    compliance_pct: number;
    at_risk_pct: number;
    overdue_checkins: number;
    snapshots: number;
    scorecards_active: number;
    period_state: 'open' | 'closed';
    by_scope: Array<{ scope: string; healthy_pct: number; green?: number; yellow?: number; red?: number }>;
  };
  snapshots: PmSnapshot[];
  audit_logs: PmAuditLog[];
};
