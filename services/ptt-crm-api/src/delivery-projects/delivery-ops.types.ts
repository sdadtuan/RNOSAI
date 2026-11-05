export type DeliveryRiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type DeliveryRiskStatus = 'open' | 'mitigated' | 'closed';
export type DeliveryChangeRequestKind = 'scope' | 'budget';
export type DeliveryChangeRequestStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export type DeliveryRiskRow = {
  id: string;
  project_id: string;
  project_code: string | null;
  project_name: string;
  severity: DeliveryRiskSeverity;
  title: string;
  owner_staff_id: number | null;
  sla_due: string | null;
  status: DeliveryRiskStatus;
  note: string | null;
  row_version: number;
  created_at: string;
  updated_at: string;
};

export type DeliveryChangeRequestRow = {
  id: string;
  project_id: string;
  project_code: string | null;
  project_name: string;
  kind: DeliveryChangeRequestKind;
  payload_json: Record<string, unknown>;
  status: DeliveryChangeRequestStatus;
  baseline_version: number;
  note: string | null;
  created_by_staff_id: number | null;
  created_at: string;
  updated_at: string;
};

export type DeliveryQualitySnapshotRow = {
  id: string;
  project_id: string;
  project_code: string | null;
  project_name: string;
  period: string;
  ontime_milestone_pct: string | null;
  client_approval_sla: string | null;
  rework_pct: string | null;
  score: string | null;
  computed_at: string;
};

export type CreateDeliveryRiskBody = {
  severity: DeliveryRiskSeverity;
  title: string;
  owner_staff_id?: number | null;
  sla_due?: string | null;
  note?: string | null;
};

export type PatchDeliveryRiskBody = {
  severity?: DeliveryRiskSeverity;
  title?: string;
  owner_staff_id?: number | null;
  sla_due?: string | null;
  status?: DeliveryRiskStatus;
  note?: string | null;
};

export type CreateDeliveryChangeRequestBody = {
  kind: DeliveryChangeRequestKind;
  payload_json?: Record<string, unknown>;
  note?: string | null;
  submit?: boolean;
};

export type CapacityAssignmentRow = {
  staff_id: number;
  team_name: string | null;
  role_name: string | null;
  allocation_pct: number;
  start_date: string;
  end_date: string;
  project_id: string;
  project_code: string | null;
  project_name: string;
  project_status: string;
};

export type CapacityTeamRow = {
  team: string;
  weeks: Array<{ week: string; pct: number; overloaded: boolean }>;
  peak_pct: number;
};
