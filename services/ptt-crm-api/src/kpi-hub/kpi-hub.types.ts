import type { CommandPersona } from './command-center/command-center.util';

export const KPI_HUB_TENANT_ID = 'PTT';
export const KPI_HUB_DEFAULT_WORKSPACE_ID = 'a0000000-0000-4000-8000-000000000001';

export type HubDictionaryStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'ACTIVE'
  | 'NEED_REVIEW'
  | 'DEPRECATED'
  | 'ARCHIVED';

export type HubCalcKind = 'COUNT' | 'SUM' | 'AVG' | 'RATIO' | 'COMPOSITE' | 'MANUAL';
export type HubDirection = 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER' | 'RANGE' | 'NEUTRAL';
export type HubPerfStatus = 'ACHIEVED' | 'WARNING' | 'CRITICAL' | 'NO_DATA' | 'NO_STATUS';
export type FreshnessLevel = 'FRESH' | 'DELAYED' | 'FAILED' | 'UNKNOWN';
export type SourceSystem = 'CRM' | 'META_ADS' | 'GOOGLE_ADS' | 'GA4' | 'SHAREPOINT' | 'ERP';
export type AlertEventStatus = 'OPEN' | 'ACK' | 'RESOLVED';
export type AlertLevel = 'CRITICAL' | 'WARNING' | 'INFO' | 'SUCCESS';
export type PeriodGrain = 'DAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';
export type QualityIssueStatus = 'OPEN' | 'ASSIGNED' | 'RESOLVED';

export const KPI_HUB_ERROR_CODES = {
  NOT_FOUND: 'KPI_HUB_NOT_FOUND',
  VERSION_CONFLICT: 'KPI_HUB_VERSION_CONFLICT',
  CODE_REQUIRED: 'KPI_HUB_CODE_REQUIRED',
  CODE_INVALID: 'KPI_HUB_CODE_INVALID',
  CODE_DUPLICATE: 'KPI_HUB_CODE_DUPLICATE',
  NAME_REQUIRED: 'KPI_HUB_NAME_REQUIRED',
  FORMULA_INVALID: 'KPI_HUB_FORMULA_INVALID',
  FORMULA_CYCLE: 'KPI_HUB_FORMULA_CYCLE',
  FORMULA_CHECKSUM_MISMATCH: 'KPI_HUB_FORMULA_CHECKSUM_MISMATCH',
  PUBLISH_BLOCKED: 'KPI_HUB_PUBLISH_BLOCKED',
  STATUS_INVALID: 'KPI_HUB_STATUS_INVALID',
  MAINTENANCE_MODE: 'KPI_HUB_MAINTENANCE_MODE',
  SOURCE_UNAVAILABLE: 'KPI_HUB_SOURCE_UNAVAILABLE',
} as const;

export type KpiHubErrorCode = (typeof KPI_HUB_ERROR_CODES)[keyof typeof KPI_HUB_ERROR_CODES];

export type PaginatedMeta = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type HubOwnerRef = { id: number; name: string; email?: string };

export type HubWorkspaceRow = {
  id: string;
  tenant_id: string;
  name: string;
  company: string;
  logo_url: string | null;
  timezone: string;
  locale: string;
  currency: string;
  week_start: string;
  default_period_grain: PeriodGrain;
  close_day: number;
  reconcile_day: number;
  lock_closed_periods: boolean;
  allow_reopen: boolean;
  require_kpi_approval: boolean;
  auto_quality: boolean;
  alerts_enabled: boolean;
  maintenance_mode: boolean;
  row_version: number;
  created_at: string;
  updated_at: string;
};

export type HubDictionaryRow = {
  id: string;
  tenant_id: string;
  workspace_id: string;
  code: string;
  name: string;
  description: string | null;
  kpi_group: string;
  kpi_group_color: string;
  kpi_type_id: string | null;
  direction: HubDirection;
  unit: string;
  decimal_places: number;
  calc_kind: HubCalcKind;
  formula_display: string | null;
  tech_preview: string | null;
  business_formula: string | null;
  blank_if_zero: boolean;
  non_additive_ratio: boolean;
  allow_manual: boolean;
  numerator_code: string | null;
  denominator_code: string | null;
  primary_source: string;
  sync_frequency: string;
  kpi_owner: HubOwnerRef;
  data_owner: HubOwnerRef;
  status: HubDictionaryStatus;
  current_version: number;
  published_at: string | null;
  row_version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type HubDictionaryListItem = Pick<
  HubDictionaryRow,
  | 'id'
  | 'code'
  | 'name'
  | 'kpi_group'
  | 'kpi_group_color'
  | 'primary_source'
  | 'sync_frequency'
  | 'data_owner'
  | 'status'
  | 'direction'
  | 'unit'
  | 'updated_at'
>;

export type HubDictionarySummary = {
  total: number;
  active: number;
  need_review: number;
  source_count: number;
};

export type HubSourceConnection = {
  id: string;
  workspace_id: string;
  system: SourceSystem;
  name: string;
  external_ref: string;
  sla_minutes: number;
  last_success_at: string | null;
  last_error: string | null;
  status: FreshnessLevel;
  entity_count: number;
  quality_pct: number | null;
  unmapped_count: number | null;
};

export type HubPeriodTargetRow = {
  id: string;
  dictionary_id: string;
  dictionary_code: string;
  dictionary_name: string;
  period: string;
  period_start: string;
  period_end: string;
  grain: PeriodGrain;
  scope_type: string;
  scope_label: string;
  hierarchy_level?: string;
  scope_hash?: string;
  direction: HubDirection;
  unit: string;
  target_value: number;
  warning_value: number | null;
  critical_value: number | null;
  actual_value: number | null;
  status: HubPerfStatus;
  trend_pct: number | null;
  alerts_enabled: boolean;
  row_version: number;
  updated_at: string;
};

export type HubTargetSummary = {
  total_kpis: number;
  with_target: number;
  achieved_pct: number;
  warning_count: number;
  critical_count: number;
};

export type HubAlertEvent = {
  id: string;
  rule_id: string;
  dictionary_id: string | null;
  dictionary_code: string | null;
  level: AlertLevel;
  title: string;
  scope: string;
  actual: number | null;
  threshold: number | null;
  status: AlertEventStatus;
  age: string;
  created_at: string;
  acknowledged_at: string | null;
  acknowledged_by: number | null;
};

export type HubQualityRule = {
  id: string;
  name: string;
  connection_id: string;
  connection_name: string;
  check_type: string;
  severity: AlertLevel;
  enabled: boolean;
  last_run_at: string | null;
  pass_rate: number | null;
  affected_count: number;
};

export type HubQualityIssue = {
  id: string;
  rule_id: string;
  rule_name: string;
  run_id?: string;
  status: QualityIssueStatus;
  severity: AlertLevel;
  title: string;
  description: string;
  affected_count: number;
  assignee: HubOwnerRef | null;
  sla_due: string | null;
  ticket_ref: string | null;
  sample_rows: Array<Record<string, unknown>>;
  created_at: string;
};

export type HubQualityRun = {
  id: string;
  started_at: string;
  finished_at: string;
  score: number;
  rules_passed: number;
  rules_total: number;
  issues_created: number;
  triggered_by: number;
};

export type HubNotificationRow = {
  id: string;
  staff_id: number;
  level: AlertLevel;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export type HubDictionaryVersionRow = {
  id: string;
  dictionary_id: string;
  version: number;
  formula_display: string | null;
  status: 'PENDING_APPROVAL' | 'ACTIVE' | 'SUPERSEDED';
  created_at: string;
  created_by: number;
};

export type HubSourceBindingRow = {
  entity_name: string;
  agg: string;
  value_field?: string;
  filters: Array<{ field: string; op: string; value?: string }>;
};

export type HubReportRow = {
  id: string;
  name: string;
  type: string;
  scope: string;
  status: string;
  owner: HubOwnerRef;
  last_generated_at: string | null;
  shared_count: number;
  schedule_cron: string | null;
  next_run_at: string | null;
  row_version: number;
  created_at: string;
  updated_at: string;
};

export type HubReportSummary = {
  total: number;
  mine: number;
  shared: number;
  sent_this_month: number;
};

export type HubActivityItem = {
  id: string;
  action: string;
  entity_type: string;
  entity_label: string;
  actor_name: string;
  created_at: string;
};


export type HubDashboardQuery = {
  from?: string;
  to?: string;
  compare?: string;
  department_id?: string;
  channel?: string;
  product?: string;
  team_id?: string;
  persona?: CommandPersona;
};

export type { CommandPersona };

export type HubDictionaryListQuery = {
  page?: number;
  page_size?: number;
  q?: string;
  status?: HubDictionaryStatus;
  kpi_group?: string;
  data_owner_id?: number;
  sort?: string;
};

export type HubTargetListQuery = {
  period?: string;
  page?: number;
  page_size?: number;
  q?: string;
  status?: HubPerfStatus;
  campaign?: string;
  team?: string;
  department?: string;
  user?: string;
  project_id?: string;
};

export type PreviewHubDictionaryBody = {
  formula_display?: string;
  numerator_code?: string;
  denominator_code?: string;
};

export type HubNotificationListQuery = {
  page?: number;
  page_size?: number;
  unread_only?: string;
};

export type HubAlertListQuery = {
  page?: number;
  page_size?: number;
  status?: AlertEventStatus;
  level?: AlertLevel;
};

export type HubReportListQuery = {
  page?: number;
  page_size?: number;
  tab?: string;
  q?: string;
};

export type PatchHubWorkspaceBody = Partial<
  Pick<
    HubWorkspaceRow,
    | 'name'
    | 'company'
    | 'timezone'
    | 'locale'
    | 'currency'
    | 'week_start'
    | 'default_period_grain'
    | 'close_day'
    | 'reconcile_day'
    | 'lock_closed_periods'
    | 'allow_reopen'
    | 'require_kpi_approval'
    | 'auto_quality'
    | 'alerts_enabled'
    | 'maintenance_mode'
  >
>;

export type CreateHubDictionaryBody = {
  code: string;
  name: string;
  description?: string;
  kpi_group?: string;
  direction?: HubDirection;
  unit?: string;
  calc_kind?: HubCalcKind;
  kpi_owner_id?: number;
  data_owner_id?: number;
};

export type PatchHubDictionaryBody = Partial<
  Pick<
    HubDictionaryRow,
    | 'name'
    | 'description'
    | 'kpi_group'
    | 'direction'
    | 'unit'
    | 'calc_kind'
    | 'formula_display'
    | 'tech_preview'
    | 'business_formula'
    | 'blank_if_zero'
    | 'non_additive_ratio'
    | 'allow_manual'
    | 'numerator_code'
    | 'denominator_code'
    | 'primary_source'
    | 'sync_frequency'
  >
> & {
  kpi_owner_id?: number;
  data_owner_id?: number;
};

export type DuplicateHubDictionaryBody = { code?: string; name?: string };

export type ValidateHubDictionaryBody = {
  calc_kind?: HubCalcKind;
  numerator_code?: string;
  denominator_code?: string;
  formula_display?: string;
};

export type UpsertHubTargetBody = {
  dictionary_id: string;
  period: string;
  scope_type?: string;
  scope_label?: string;
  scope_project_id?: string;
  target_value: number;
  warning_value?: number;
  critical_value?: number;
  alerts_enabled?: boolean;
  alert_frequency_minutes?: number;
  alert_channels?: string[];
};

export type PatchHubTargetBody = Partial<
  Pick<
    UpsertHubTargetBody,
    'target_value' | 'warning_value' | 'critical_value' | 'alerts_enabled'
  >
>;

export type CreateHubReportBody = {
  name: string;
  type: string;
  scope?: string;
  definition?: Record<string, unknown>;
};

export type ShareHubReportBody = { user_ids?: number[]; team_ids?: number[]; message?: string };
export type ScheduleHubReportBody = { cron: string; channel: string; recipient_ids?: number[] };
export type AssignQualityIssueBody = { assignee_id: number };
export type CreateQualityTicketBody = { title?: string; priority?: string };

export type KpiHubActor = { staffId: number; canConfigure: boolean; canPublish: boolean };
