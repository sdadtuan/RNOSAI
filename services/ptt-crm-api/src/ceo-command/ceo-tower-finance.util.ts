import type { TowerException } from './ceo-tower.types';

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

export type TowerFinanceMetricsInput = {
  cash_close: number | null;
  cash_safe_min_vnd: number;
  ar_overdue: number | null;
  ar_overdue_max_vnd: number;
  revenue_received_30d: number | null;
  top1_share_pct: number | null;
  top1_share_max_pct: number;
  gross_margin: number | null;
  gross_margin_target_pct: number;
};

function ragHigherBetter(value: number, target: number): TowerFinanceCell['status'] {
  if (value >= target) return 'green';
  return value >= target * 0.85 ? 'amber' : 'red';
}

function ragLowerBetter(value: number, target: number): TowerFinanceCell['status'] {
  if (value <= target) return 'green';
  return value <= target * 1.15 ? 'amber' : 'red';
}

function dt30Status(value: number | null): TowerFinanceCell['status'] {
  if (value == null) return 'neutral';
  if (value === 0) return 'amber';
  return 'neutral';
}

export function isS11Fail(top1Pct: number, maxPct = 40): boolean {
  return Number.isFinite(top1Pct) && top1Pct > maxPct;
}

export function buildS11Exception(top1Pct: number): TowerException {
  void top1Pct;
  return {
    factory: 'A',
    column_id: 'care',
    sensor_ids: ['S11'],
    severity: 'red',
    title_vi: 'Top-1 khách > 40% DT',
    entity_type: 'lead',
    entity_id: 0,
    owner_staff_id: null,
    owner_name: '',
    age_label: '',
    value_vnd: null,
    department_code: null,
    team_code: null,
    position_code: null,
    job_function: null,
    href: '/crm/owner-weekly',
    suggest_action: null,
    suggest_params: null,
  };
}

export function buildFinanceStrip(input: TowerFinanceMetricsInput): TowerFinanceStrip {
  const cashValue = input.cash_close;
  const arValue = input.ar_overdue;
  const dt30Value = input.revenue_received_30d;
  const top1Value = input.top1_share_pct;
  const gmValue = input.gross_margin;

  return [
    {
      key: 'cash',
      label_vi: 'Tiền',
      value: cashValue,
      status:
        cashValue != null && Number.isFinite(cashValue)
          ? ragHigherBetter(cashValue, input.cash_safe_min_vnd)
          : 'neutral',
      target: input.cash_safe_min_vnd,
      href: '/crm/owner-weekly',
    },
    {
      key: 'ar',
      label_vi: 'AR',
      value: arValue,
      status:
        arValue != null && Number.isFinite(arValue)
          ? ragLowerBetter(arValue, input.ar_overdue_max_vnd)
          : 'neutral',
      target: input.ar_overdue_max_vnd,
      href: '/crm/financials',
    },
    {
      key: 'dt30',
      label_vi: 'DT30',
      value: dt30Value,
      status: dt30Status(dt30Value),
      href: '/crm/business-dashboard',
    },
    {
      key: 'top1',
      label_vi: 'Top-1%',
      value: top1Value,
      status:
        top1Value != null && Number.isFinite(top1Value)
          ? ragLowerBetter(top1Value, input.top1_share_max_pct)
          : 'neutral',
      target: input.top1_share_max_pct,
      href: '/crm/owner-weekly',
    },
    {
      key: 'gm',
      label_vi: 'GM%',
      value: gmValue,
      status:
        gmValue != null && Number.isFinite(gmValue)
          ? ragHigherBetter(gmValue, input.gross_margin_target_pct)
          : 'neutral',
      target: input.gross_margin_target_pct,
      href: '/crm/owner-weekly',
    },
  ];
}
