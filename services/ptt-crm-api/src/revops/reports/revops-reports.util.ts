export const REVOPS_REPORT_SLUGS = [
  'executive-revenue-forecast',
  'lead-sla-leakage',
  'key-account-health',
  'commission-payout-reconciliation',
] as const;

export type RevopsReportSlug = (typeof REVOPS_REPORT_SLUGS)[number];

export type RevopsReportLibraryItem = {
  slug: RevopsReportSlug;
  name: string;
  description: string;
  group: string;
  owner: string;
  scheduleLabel: string;
  schedulerStatus: 'manual';
  lastUpdated: string;
};

export type RevopsRevenueTrendPoint = {
  month: string;
  label: string;
  actualVnd: number | null;
  forecastVnd: number | null;
};

export type RevopsRevenueMixRow = {
  key: 'new' | 'renewal' | 'upsell';
  label: string;
  vnd: number;
  pct: number | null;
};

export type RevopsCommissionLiability = {
  totalVnd: number | null;
  approvedVnd: number | null;
  pendingVnd: number | null;
  clawbackVnd: number | null;
};

export function isRevopsReportSlug(value: string): value is RevopsReportSlug {
  return (REVOPS_REPORT_SLUGS as readonly string[]).includes(value);
}

export function seedReportLibrary(lastUpdated: string): RevopsReportLibraryItem[] {
  return [
    {
      slug: 'executive-revenue-forecast',
      name: 'Executive Revenue Forecast',
      description: 'Actual vs forecast theo BU, territory, product',
      group: 'Revenue',
      owner: 'RevOps',
      scheduleLabel: 'Thứ Hai 08:00',
      schedulerStatus: 'manual',
      lastUpdated,
    },
    {
      slug: 'lead-sla-leakage',
      name: 'Lead SLA & Leakage Report',
      description: 'Response time, breach, routing, unassigned lead',
      group: 'Operations',
      owner: 'Sales Ops',
      scheduleLabel: 'Daily 18:00',
      schedulerStatus: 'manual',
      lastUpdated,
    },
    {
      slug: 'key-account-health',
      name: 'Key Account Health & Renewal Risk',
      description: 'Health score, risk, expiry, account plan compliance',
      group: 'Account',
      owner: 'Account Director',
      scheduleLabel: 'Weekly',
      schedulerStatus: 'manual',
      lastUpdated,
    },
    {
      slug: 'commission-payout-reconciliation',
      name: 'Commission Payout Reconciliation',
      description: 'Estimated, approved, paid, adjustment, clawback',
      group: 'Finance',
      owner: 'Finance',
      scheduleLabel: 'Monthly',
      schedulerStatus: 'manual',
      lastUpdated,
    },
  ];
}

export function quarterLabel(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period.trim());
  if (!match) return period;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const quarter = Math.ceil(month / 3);
  return `Q${quarter}/${year}`;
}

export function quarterMonths(period: string): string[] {
  const match = /^(\d{4})-(\d{2})$/.exec(period.trim());
  if (!match) return [period];
  const year = Number(match[1]);
  const month = Number(match[2]);
  const qStart = Math.floor((month - 1) / 3) * 3 + 1;
  return [0, 1, 2].map((i) => `${year}-${String(qStart + i).padStart(2, '0')}`);
}

function monthShortLabel(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period.trim());
  if (!match) return period;
  const month = Number(match[2]);
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return labels[month - 1] ?? period;
}

export function buildRevenueTrend(
  period: string,
  actualVnd: number | null,
  forecastVnd: number | null,
): RevopsRevenueTrendPoint[] {
  return quarterMonths(period).map((month) => ({
    month,
    label: monthShortLabel(month),
    actualVnd: month === period ? actualVnd : null,
    forecastVnd: month === period ? forecastVnd : null,
  }));
}

export function buildRevenueMix(input: {
  newVnd: number;
  renewalVnd: number;
  upsellVnd: number;
}): { rows: RevopsRevenueMixRow[]; totalVnd: number } {
  const totalVnd = input.newVnd + input.renewalVnd + input.upsellVnd;
  const rows: RevopsRevenueMixRow[] = [
    { key: 'new', label: 'New business', vnd: input.newVnd, pct: null },
    { key: 'renewal', label: 'Renewal', vnd: input.renewalVnd, pct: null },
    { key: 'upsell', label: 'Upsell / Cross-sell', vnd: input.upsellVnd, pct: null },
  ];
  if (totalVnd <= 0) return { rows, totalVnd: 0 };
  for (const row of rows) {
    row.pct = Math.round((row.vnd / totalVnd) * 100);
  }
  return { rows, totalVnd };
}

export function buildCommissionLiability(input: {
  estimatedVnd: number | null;
  approvedVnd: number | null;
  pendingVnd: number | null;
  clawbackVnd: number | null;
}): RevopsCommissionLiability {
  return {
    totalVnd: input.estimatedVnd,
    approvedVnd: input.approvedVnd,
    pendingVnd: input.pendingVnd,
    clawbackVnd: input.clawbackVnd,
  };
}

export function sumClawbackVnd(
  transactions: Array<{ commissionVnd: number; status: string }>,
): number {
  let total = 0;
  for (const tx of transactions) {
    if (tx.status === 'clawback' || tx.commissionVnd < 0) {
      total += Math.abs(tx.commissionVnd);
    }
  }
  return total;
}

function csvEscape(value: string | number | null | undefined): string {
  const raw = value == null ? '' : String(value);
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

export function buildReportCsv(
  slug: RevopsReportSlug,
  payload: {
    period: string;
    bu: string;
    territory: string;
    revenueTrend: RevopsRevenueTrendPoint[];
    revenueMix: { rows: RevopsRevenueMixRow[]; totalVnd: number };
    commission: RevopsCommissionLiability;
    sla?: {
      compliancePct: number | null;
      breaches: number;
      incidents: Array<{ id: string; title: string; status: string; dueAt: string }>;
    };
    atRisk?: Array<{ id: string; title: string; severity: string }>;
    transactions?: Array<{
      id: string;
      dealRef: string;
      commissionVnd: number;
      status: string;
    }>;
  },
): string {
  const meta = [`period,${csvEscape(payload.period)}`, `bu,${csvEscape(payload.bu)}`, `territory,${csvEscape(payload.territory)}`, ''];
  if (slug === 'executive-revenue-forecast') {
    return [
      ...meta,
      'month,actual_vnd,forecast_vnd',
      ...payload.revenueTrend.map(
        (p) => `${csvEscape(p.month)},${csvEscape(p.actualVnd)},${csvEscape(p.forecastVnd)}`,
      ),
      '',
      'mix_key,mix_label,vnd,pct',
      ...payload.revenueMix.rows.map(
        (r) => `${csvEscape(r.key)},${csvEscape(r.label)},${csvEscape(r.vnd)},${csvEscape(r.pct)}`,
      ),
    ].join('\n');
  }
  if (slug === 'lead-sla-leakage') {
    const sla = payload.sla ?? { compliancePct: null, breaches: 0, incidents: [] };
    return [
      ...meta,
      `compliance_pct,${csvEscape(sla.compliancePct)}`,
      `breaches,${csvEscape(sla.breaches)}`,
      '',
      'incident_id,title,status,due_at',
      ...sla.incidents.map(
        (i) =>
          `${csvEscape(i.id)},${csvEscape(i.title)},${csvEscape(i.status)},${csvEscape(i.dueAt)}`,
      ),
    ].join('\n');
  }
  if (slug === 'key-account-health') {
    const risks = payload.atRisk ?? [];
    return [
      ...meta,
      'risk_id,title,severity',
      ...risks.map((r) => `${csvEscape(r.id)},${csvEscape(r.title)},${csvEscape(r.severity)}`),
    ].join('\n');
  }
  const txs = payload.transactions ?? [];
  return [
    ...meta,
    `total_vnd,${csvEscape(payload.commission.totalVnd)}`,
    `approved_vnd,${csvEscape(payload.commission.approvedVnd)}`,
    `pending_vnd,${csvEscape(payload.commission.pendingVnd)}`,
    `clawback_vnd,${csvEscape(payload.commission.clawbackVnd)}`,
    '',
    'transaction_id,deal_ref,commission_vnd,status',
    ...txs.map(
      (t) =>
        `${csvEscape(t.id)},${csvEscape(t.dealRef)},${csvEscape(t.commissionVnd)},${csvEscape(t.status)}`,
    ),
  ].join('\n');
}
