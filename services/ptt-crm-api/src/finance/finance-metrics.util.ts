export const BILLING_TYPE_RECURRING = 'recurring';
export const BILLING_TYPE_ONE_OFF = 'one_off';
export const COST_PHASE_PRESALES = 'presales';
export const COST_PHASE_DELIVERY = 'delivery';

export const AR_AGING_BUCKET_KEYS = ['not_due', '1_30', '31_60', '61_90', 'over_90'] as const;

export const AR_AGING_BUCKET_LABELS: Record<string, string> = {
  not_due: 'Chưa đến hạn',
  '1_30': '1–30 ngày',
  '31_60': '31–60 ngày',
  '61_90': '61–90 ngày',
  over_90: '>90 ngày',
};

export function rowDict(row: Record<string, unknown>): Record<string, unknown> {
  return { ...row };
}

export function parseYmd(raw: string | null | undefined): string | null {
  const text = String(raw ?? '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [y, m, d] = text.split('-').map(Number);
  const dt = new Date(y!, m! - 1, d!);
  if (dt.getFullYear() !== y || dt.getMonth() !== m! - 1 || dt.getDate() !== d) return null;
  return text;
}

export function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export function resolvePaymentDueOn(payment: Record<string, unknown>): string {
  const due = parseYmd(String(payment.due_on ?? ''));
  if (due) return due;
  return parseYmd(String(payment.received_on ?? '')) ?? '';
}

export function deliveryPhaseSql(column = 'cost_phase'): string {
  return `COALESCE(NULLIF(${column}, ''), '${COST_PHASE_DELIVERY}') = '${COST_PHASE_DELIVERY}'`;
}

export {
  getArAging,
  getCacMetrics,
  getConcentrationMetrics,
  getExecMetrics,
  getFinanceKpiInboxSummary,
  getFinancialLifecycleRows,
  getLeadKpiSummary,
  getMarketingSpendVnd,
  getMrrArrMetrics,
  getPortfolioMetrics,
  getRecurringRevenueSummary,
  getRetentionMetrics,
  getServicePackageRollup,
  getSummary,
  setMarketingSpendVnd,
  tableExists,
} from './finance-pg-metrics.util';
