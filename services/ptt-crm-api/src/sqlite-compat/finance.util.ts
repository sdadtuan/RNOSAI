import { DatabaseSync } from 'node:sqlite';
import {
  ATTRIBUTION_DRILL_DEFAULT,
  buildExecutiveWeekBuckets,
  EXECUTIVE_WEEKLY_DEFAULT,
  resolveExecutiveAnchorYmd,
} from '../finance/business-dashboard.util';
import {
  AR_AGING_BUCKET_KEYS,
  AR_AGING_BUCKET_LABELS,
  BILLING_TYPE_ONE_OFF,
  COST_PHASE_DELIVERY,
  COST_PHASE_PRESALES,
  parseYmd,
  resolvePaymentDueOn,
  todayYmd,
} from '../finance/finance-metrics.util';

export function tableExists(db: DatabaseSync, name: string): boolean {
  return db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name) != null;
}

export function ensureKpiConfigSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS crm_finance_kpi_config (
      config_key TEXT PRIMARY KEY,
      config_value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT ''
    )
  `);
}

export function sumReceivedRevenueForRange(
  db: DatabaseSync,
  start: string,
  end: string,
): number {
  if (!tableExists(db, 'crm_svc_payments')) return 0;
  const row = db
    .prepare(`
      SELECT COALESCE(SUM(amount_vnd), 0) AS v
      FROM crm_svc_payments
      WHERE status = 'received' AND received_on >= ? AND received_on <= ?
    `)
    .get(start, end) as Record<string, unknown> | undefined;
  return Number(row?.v ?? 0);
}

export function getMarketingSpendVnd(
  db: DatabaseSync,
  year: number,
  month: number,
): [number, string] {
  if (tableExists(db, 'crm_finance_period_inputs')) {
    const row = db
      .prepare(
        'SELECT marketing_spend_vnd FROM crm_finance_period_inputs WHERE year = ? AND month = ?',
      )
      .get(year, month) as Record<string, unknown> | undefined;
    if (row) return [Number(row.marketing_spend_vnd ?? 0), 'db'];
  }
  const raw = String(process.env.PTT_MONTHLY_MARKETING_SPEND_VND ?? '').trim();
  return [raw ? Math.max(0, Number(raw) || 0) : 0, raw ? 'env' : 'default'];
}

function sumReceivedRevenue(db: DatabaseSync, start: string, end: string): number {
  return sumReceivedRevenueForRange(db, start, end);
}

function countLeadsCreated(db: DatabaseSync, start: string, end: string): number {
  if (!tableExists(db, 'crm_leads')) return 0;
  const row = db
    .prepare(`
      SELECT COUNT(*) AS v FROM crm_leads
      WHERE COALESCE(is_duplicate, 0) = 0
        AND substr(replace(trim(created_at), 'T', ' '), 1, 10) >= ?
        AND substr(replace(trim(created_at), 'T', ' '), 1, 10) <= ?
    `)
    .get(start, end) as Record<string, unknown> | undefined;
  return Number(row?.v ?? 0);
}

export function getExecutiveWeeklyTrends(
  db: DatabaseSync,
  year: number,
  month: number,
  weeks = EXECUTIVE_WEEKLY_DEFAULT,
): Record<string, unknown> {
  const anchor = resolveExecutiveAnchorYmd(year, month);
  const buckets = buildExecutiveWeekBuckets(anchor, weeks).map((bucket) => ({
    ...bucket,
    revenue_vnd: sumReceivedRevenue(db, bucket.start, bucket.end),
    leads: countLeadsCreated(db, bucket.start, bucket.end),
  }));
  return {
    weeks: buckets.length,
    anchor,
    labels: buckets.map((bucket) => bucket.label),
    revenue_vnd: buckets.map((bucket) => bucket.revenue_vnd),
    leads: buckets.map((bucket) => bucket.leads),
    buckets,
  };
}

function leadCampaignSql(): string {
  return `COALESCE(
    NULLIF(trim(utm_campaign), ''),
    NULLIF(trim(json_extract(meta_json, '$.campaign_id')), ''),
    NULLIF(trim(json_extract(meta_json, '$.facebook_campaign_id')), ''),
    NULLIF(trim(json_extract(meta_json, '$.utm_campaign')), '')
  )`;
}

export function getAttributionDrillPaths(
  db: DatabaseSync,
  year: number,
  month: number,
  limit = ATTRIBUTION_DRILL_DEFAULT,
): Record<string, unknown> {
  if (!tableExists(db, 'crm_leads')) return { rows: [], count: 0 };
  const prefix = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
  const campaignExpr = leadCampaignSql();
  const rows = db
    .prepare(`
      SELECT ${campaignExpr} AS campaign_key, COUNT(*) AS lead_count, MAX(id) AS sample_lead_id
      FROM crm_leads
      WHERE COALESCE(is_duplicate, 0) = 0
        AND substr(replace(trim(created_at), 'T', ' '), 1, 7) = ?
        AND ${campaignExpr} IS NOT NULL AND trim(${campaignExpr}) != ''
      GROUP BY campaign_key ORDER BY lead_count DESC, campaign_key ASC LIMIT ?
    `)
    .all(prefix, Math.max(1, Math.min(Math.trunc(limit), 10))) as Array<Record<string, unknown>>;
  const drillRows = rows.map((row) => {
    const campaignKey = String(row.campaign_key ?? '').trim();
    const sampleLeadId = row.sample_lead_id == null ? null : Number(row.sample_lead_id);
    const lead = sampleLeadId == null
      ? undefined
      : (db.prepare('SELECT full_name FROM crm_leads WHERE id = ? LIMIT 1').get(sampleLeadId) as
          | Record<string, unknown>
          | undefined);
    return {
      campaign_key: campaignKey,
      campaign_label: campaignKey,
      lead_count: Number(row.lead_count ?? 0),
      sample_lead_id: sampleLeadId,
      sample_lead_name: lead?.full_name ? String(lead.full_name) : null,
      hub_href: `/crm/hub?campaign_id=${encodeURIComponent(campaignKey)}`,
      lead_href: sampleLeadId == null ? null : `/crm/leads/${sampleLeadId}`,
    };
  });
  return { year, month, count: drillRows.length, rows: drillRows };
}

export function getSummary(
  db: DatabaseSync,
  lifecycleId: number,
  contractAmountVnd: number,
): Record<string, unknown> {
  const payments = tableExists(db, 'crm_svc_payments')
    ? (db.prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN status = 'received' THEN amount_vnd ELSE 0 END), 0) AS received,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN amount_vnd ELSE 0 END), 0) AS pending
        FROM crm_svc_payments WHERE lifecycle_id = ?
      `).get(lifecycleId) as Record<string, unknown>)
    : {};
  const received = Number(payments.received ?? 0);
  const pending = Number(payments.pending ?? 0);
  let deliveryExpenses = 0;
  let presalesExpenses = 0;
  if (tableExists(db, 'crm_svc_expenses')) {
    const delivery = db
      .prepare(
        `SELECT COALESCE(SUM(amount_vnd), 0) AS v FROM crm_svc_expenses
         WHERE lifecycle_id = ? AND COALESCE(NULLIF(cost_phase, ''), ?) = ?`,
      )
      .get(lifecycleId, COST_PHASE_DELIVERY, COST_PHASE_DELIVERY) as Record<string, unknown>;
    const presales = db
      .prepare(
        'SELECT COALESCE(SUM(amount_vnd), 0) AS v FROM crm_svc_expenses WHERE lifecycle_id = ? AND cost_phase = ?',
      )
      .get(lifecycleId, COST_PHASE_PRESALES) as Record<string, unknown>;
    deliveryExpenses = Number(delivery.v ?? 0);
    presalesExpenses = Number(presales.v ?? 0);
  }
  const profit = received - deliveryExpenses;
  let arPending = 0;
  let arOverdue = 0;
  if (tableExists(db, 'crm_svc_payments')) {
    const pendingRows = db
      .prepare(
        "SELECT amount_vnd, due_on, received_on FROM crm_svc_payments WHERE lifecycle_id = ? AND status = 'pending'",
      )
      .all(lifecycleId) as Array<Record<string, unknown>>;
    const asOf = todayYmd();
    for (const row of pendingRows) {
      const amount = Number(row.amount_vnd ?? 0);
      arPending += amount;
      const due = parseYmd(resolvePaymentDueOn(row));
      if (due && due < asOf) arOverdue += amount;
    }
  }
  return {
    expected_revenue: contractAmountVnd,
    received_revenue: received,
    pending_revenue: pending,
    ar_pending_vnd: arPending,
    ar_overdue_vnd: arOverdue,
    delivery_expenses: deliveryExpenses,
    presales_expenses: presalesExpenses,
    total_expenses: deliveryExpenses + presalesExpenses,
    profit,
    margin_pct: received > 0 ? Math.round((profit / received) * 10000) / 100 : 0,
    outstanding: contractAmountVnd - received,
  };
}

export function getArAging(
  db: DatabaseSync,
  opts: { asOf?: string | null; amId?: number | null } = {},
): Record<string, unknown> {
  const asOf = parseYmd(opts.asOf) ?? todayYmd();
  const buckets = Object.fromEntries(AR_AGING_BUCKET_KEYS.map((key) => [key, 0])) as Record<string, number>;
  if (!tableExists(db, 'crm_svc_payments') || !tableExists(db, 'crm_service_lifecycle')) {
    return {
      as_of: asOf,
      am_id: opts.amId ?? null,
      total_pending_vnd: 0,
      total_overdue_vnd: 0,
      buckets,
      bucket_labels: AR_AGING_BUCKET_LABELS,
      items: [],
    };
  }
  const where = ["p.status = 'pending'"];
  const params: Array<string | number> = [];
  if (opts.amId != null) {
    where.push('lc.assigned_am = ?');
    params.push(opts.amId);
  }
  const rows = db.prepare(`
    SELECT p.id, p.lifecycle_id, p.amount_vnd, p.received_on, p.due_on, p.notes,
           lc.assigned_am, lc.service_slug, cu.name AS customer_name,
           COALESCE(ct.billing_type, '${BILLING_TYPE_ONE_OFF}') AS billing_type
    FROM crm_svc_payments p
    INNER JOIN crm_service_lifecycle lc ON lc.id = p.lifecycle_id
    LEFT JOIN crm_customers cu ON cu.id = lc.customer_id
    LEFT JOIN crm_contracts ct ON ct.id = lc.contract_id
    WHERE ${where.join(' AND ')}
  `).all(...params) as Array<Record<string, unknown>>;
  let totalPending = 0;
  let totalOverdue = 0;
  const items = rows.map((row) => {
    const amount = Number(row.amount_vnd ?? 0);
    const dueOn = resolvePaymentDueOn(row);
    const due = parseYmd(dueOn);
    const days = due
      ? Math.max(0, Math.floor((new Date(`${asOf}T00:00:00`).getTime() - new Date(`${due}T00:00:00`).getTime()) / 86400000))
      : 0;
    const bucket = days <= 0 ? 'not_due' : days <= 30 ? '1_30' : days <= 60 ? '31_60' : days <= 90 ? '61_90' : 'over_90';
    buckets[bucket] = (buckets[bucket] ?? 0) + amount;
    totalPending += amount;
    if (days > 0) totalOverdue += amount;
    return { ...row, amount_vnd: amount, due_on: dueOn, days_overdue: days, bucket };
  });
  return {
    as_of: asOf,
    am_id: opts.amId ?? null,
    total_pending_vnd: totalPending,
    total_overdue_vnd: totalOverdue,
    buckets,
    bucket_labels: AR_AGING_BUCKET_LABELS,
    items,
  };
}
