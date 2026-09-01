import { API_BASE } from '@/lib/api';

export type TowerFactory = 'A' | 'B';
export type TowerColumnId =
  | 'lead_b2'
  | 'intake'
  | 'consult'
  | 'contract'
  | 'tmmt_deliver'
  | 'care';
export type TowerSeverity = 'red' | 'amber' | 'ok';
export type TowerSensorId =
  | 'S1'
  | 'S2'
  | 'S3'
  | 'S4'
  | 'S5'
  | 'S6'
  | 'S7'
  | 'S8'
  | 'S9'
  | 'S10'
  | 'S11'
  | 'S12';

export type TowerCapacityRow = {
  staff_id: number;
  name: string;
  department_code: string | null;
  position_code: string | null;
  red_owned: number;
  amber_owned: number;
  flag: 'amber' | 'red';
};

export type TowerException = {
  factory: TowerFactory;
  column_id: TowerColumnId;
  sensor_ids: TowerSensorId[];
  severity: 'red' | 'amber' | 'ok';
  title_vi: string;
  entity_type: 'lead' | 'lifecycle';
  entity_id: number;
  owner_staff_id: number | null;
  owner_name: string;
  age_label: string;
  value_vnd: number | null;
  department_code: string | null;
  team_code: string | null;
  position_code: string | null;
  job_function: string | null;
  href: string;
  suggest_action: string | null;
  suggest_params: Record<string, unknown> | null;
};

export type TowerFinanceCellKey = 'cash' | 'ar' | 'dt30' | 'top1' | 'gm';

export type TowerFinanceCell = {
  key: TowerFinanceCellKey;
  label_vi: string;
  value: number | null;
  status: 'green' | 'amber' | 'red' | 'neutral';
  target?: number | null;
  href: string;
};

export type TowerFinanceStrip = TowerFinanceCell[];

export type TowerPayload = {
  ok: true;
  generated_at: string;
  window_exception_days: 7;
  k_strip: Array<{
    key: 'k1' | 'k2' | 'k3' | 'k4';
    value: number | null;
    status: 'green' | 'amber' | 'red' | 'neutral';
    href: string;
  }>;
  columns: Array<{
    column_id: TowerColumnId;
    red_count: number;
    amber_count: number;
    ok_count: number;
    header_severity: TowerSeverity;
    degraded?: { reason: string };
  }>;
  exceptions: TowerException[];
  org_rollup: Array<{
    level: 'company' | 'factory' | 'department' | 'team' | 'position' | 'staff';
    code: string;
    label_vi: string;
    red_count: number;
    amber_count: number;
    outside_cycle?: boolean;
  }>;
  next_cursor: string | null;
  degraded: Array<{ source: string; reason: string }>;
  sensors_ok: Record<TowerSensorId, 'ok' | 'fail' | 'degraded'>;
  finance_strip?: TowerFinanceStrip;
  capacity_top?: TowerCapacityRow[];
  legal_entity_id?: string | null;
};

export async function fetchCeoTower(
  token: string,
  q: Record<string, string>,
): Promise<TowerPayload> {
  const qs = new URLSearchParams(q).toString();
  const res = await fetch(`${API_BASE}/api/crm/ceo/tower?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`tower_${res.status}`);
  return res.json() as Promise<TowerPayload>;
}
