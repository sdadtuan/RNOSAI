export const ROLE_KPI_KEYS = [
  'am',
  'graphic',
  'content',
  'video',
  'ads',
  'pm',
] as const;

export type RoleKpiKey = (typeof ROLE_KPI_KEYS)[number];

export const ROLE_KPI_STATUSES = [
  'draft',
  'review',
  'approved',
  'locked',
  'cancelled',
] as const;

export type RoleKpiStatus = (typeof ROLE_KPI_STATUSES)[number];

export const ROLE_KPI_EDITABLE_STATUSES: ReadonlySet<RoleKpiStatus> = new Set([
  'draft',
  'review',
]);

export type OpsKpiTargetWriteMeta = {
  actor: string;
  approvedAt: string;
};

export type OpsRoleKpiTargetRow = {
  id: number;
  plan_id: number | null;
  lifecycle_id: number | null;
  client_id: string | null;
  campaign_id: number | null;
  role_key: string;
  kpi_key: string;
  kpi_label: string;
  period_start: string | null;
  period_end: string | null;
  target_value: number | null;
  target_unit: string;
  actual_value: number | null;
  status: RoleKpiStatus;
  owner_staff_id: string | null;
  form_data: Record<string, unknown>;
  notes: string;
  upsert_key: string | null;
  created_at: string;
  updated_at: string;
};

export type OpsKpiTargetWriteResult = {
  ok: true;
  wired: true;
  phase: 'P5-KPI';
  status: 'persisted';
  kpi_target_id: number;
  role_key: string;
  kpi_key: string;
  kpi_status: RoleKpiStatus;
  links: string[];
};

export type OpsKpiTargetBatchWriteResult = {
  ok: true;
  wired: true;
  phase: 'P5-KPI';
  status: 'persisted';
  items: OpsKpiTargetWriteResult[];
  kpi_target_ids: number[];
  links: string[];
};

export type OpsKpiTargetReadResult = {
  ok: true;
  wired: true;
  phase: 'P5-KPI';
  tool: 'kpi_target.read';
  rows: OpsRoleKpiTargetRow[];
  known: string[];
  assumed: string[];
  unknown: string[];
  links: string[];
};

export function isRoleKpiKey(raw: string): raw is RoleKpiKey {
  return (ROLE_KPI_KEYS as readonly string[]).includes(raw);
}

export function isRoleKpiStatus(raw: string): raw is RoleKpiStatus {
  return (ROLE_KPI_STATUSES as readonly string[]).includes(raw);
}
