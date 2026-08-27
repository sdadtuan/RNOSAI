import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';

const RAG_GREEN = 'green';
const RAG_YELLOW = 'yellow';
const RAG_RED = 'red';
const BLOCK_KEYS = ['cash', 'sales', 'efficiency', 'risk'] as const;
const CASH_SOURCES = new Set(['manual', 'bank']);

const RAG_LABELS: Record<string, string> = {
  [RAG_GREEN]: 'Đạt / vượt target',
  [RAG_YELLOW]: 'Lệch nhẹ — theo dõi sát',
  [RAG_RED]: 'Cần xử lý trong 7 ngày',
};

const BLOCK_LABELS: Record<string, string> = {
  cash: 'Tiền',
  sales: 'Kinh doanh',
  efficiency: 'Hiệu quả',
  risk: 'Rủi ro',
};

export const OWNER_WEEKLY_TARGET_DEFAULTS: Record<string, number> = {
  cash_safe_min_vnd: 50_000_000,
  cash_forecast_min_vnd: 0,
  ar_overdue_max_vnd: 30_000_000,
  lead_new_target: 5,
  lead_qualified_target: 3,
  proposals_target: 2,
  deals_closed_target: 1,
  revenue_target_vnd: 20_000_000,
  pipeline_next_min_vnd: 50_000_000,
  gross_margin_target_pct: 30,
  net_margin_target_pct: 15,
  cac_max_vnd: 15_000_000,
  roas_min: 3,
  cycle_time_max_days: 45,
  ontime_target_pct: 85,
  close_rate_target_pct: 30,
  bad_debt_min_vnd: 10_000_000,
  bad_debt_min_days: 30,
  late_projects_max: 0,
  stuck_work_max: 3,
  capacity_max_util_pct: 85,
  top_deal_share_max_pct: 40,
  top1_share_max_pct: 40,
  churn_max_pct: 10,
  win_rate_drop_warn_pct: 15,
  win_rate_drop_critical_pct: 20,
};

export const OWNER_WEEKLY_ENV_KEYS: Record<string, string> = Object.fromEntries(
  Object.keys(OWNER_WEEKLY_TARGET_DEFAULTS).map((key) => [
    key,
    `PTT_OWNER_WEEKLY_${key.toUpperCase()}`,
  ]),
);

export const OWNER_WEEKLY_TARGET_LABELS: Record<string, string> = {
  cash_safe_min_vnd: 'Tiền an toàn tối thiểu (VNĐ)',
  cash_forecast_min_vnd: 'Cash forecast 30 ngày tối thiểu (VNĐ)',
  ar_overdue_max_vnd: 'AR quá hạn tối đa (VNĐ)',
  lead_new_target: 'Lead mới / tuần',
  lead_qualified_target: 'Lead đủ chuẩn / tuần',
  proposals_target: 'Báo giá gửi / tuần',
  deals_closed_target: 'Deal chốt / tuần',
  revenue_target_vnd: 'Doanh thu tuần (VNĐ)',
  pipeline_next_min_vnd: 'Pipeline tối thiểu (VNĐ)',
  gross_margin_target_pct: 'Gross margin target (%)',
  net_margin_target_pct: 'Net margin target (%)',
  cac_max_vnd: 'CAC tối đa (VNĐ)',
  roas_min: 'ROAS tối thiểu',
  cycle_time_max_days: 'Cycle time tối đa (ngày)',
  ontime_target_pct: 'On-time delivery target (%)',
  close_rate_target_pct: 'Win rate target (%)',
  bad_debt_min_vnd: 'Nợ xấu tối thiểu / KH (VNĐ)',
  bad_debt_min_days: 'Nợ xấu — ngày quá hạn tối thiểu',
  late_projects_max: 'Dự án trễ tối đa',
  stuck_work_max: 'Đầu việc kẹt tối đa',
  capacity_max_util_pct: 'Utilization tối đa (%)',
  top_deal_share_max_pct: 'Deal phụ thuộc tối đa (%)',
  top1_share_max_pct: 'Top-1 DT tối đa (%)',
  churn_max_pct: 'Churn tối đa (%)',
  win_rate_drop_warn_pct: 'Win rate giảm — cảnh báo (%)',
  win_rate_drop_critical_pct: 'Win rate giảm — nghiêm trọng (%)',
};

export const OWNER_WEEKLY_TARGET_GROUPS: Array<[string, string, string[]]> = [
  ['cash', 'Tiền', ['cash_safe_min_vnd', 'cash_forecast_min_vnd', 'ar_overdue_max_vnd', 'revenue_target_vnd']],
  ['sales', 'Kinh doanh', ['lead_new_target', 'lead_qualified_target', 'proposals_target', 'deals_closed_target', 'pipeline_next_min_vnd', 'close_rate_target_pct']],
  ['efficiency', 'Hiệu quả', ['gross_margin_target_pct', 'net_margin_target_pct', 'cac_max_vnd', 'roas_min', 'cycle_time_max_days', 'ontime_target_pct']],
  ['risk', 'Rủi ro', ['bad_debt_min_vnd', 'bad_debt_min_days', 'late_projects_max', 'stuck_work_max', 'capacity_max_util_pct', 'top_deal_share_max_pct', 'top1_share_max_pct', 'churn_max_pct', 'win_rate_drop_warn_pct', 'win_rate_drop_critical_pct']],
];

type WeekOptions = {
  weekEnd?: string | null;
  year?: number | null;
  isoWeek?: number | null;
  trendWeeks?: number;
};

function dateIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? '').slice(0, 10);
}

function timestampIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? '');
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseYmd(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

function dateFromIsoWeek(year: number, week: number, day: number): string {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay();
  const start = new Date(simple);
  if (dow <= 4) start.setUTCDate(simple.getUTCDate() - dow + 1);
  else start.setUTCDate(simple.getUTCDate() + 8 - dow);
  start.setUTCDate(start.getUTCDate() + day - 1);
  return start.toISOString().slice(0, 10);
}

function resolveWeekBounds(opts: WeekOptions): {
  start: string;
  end: string;
  isoYear: number;
  isoWeek: number;
} {
  if (opts.year != null && opts.isoWeek != null) {
    return {
      start: dateFromIsoWeek(opts.year, opts.isoWeek, 1),
      end: dateFromIsoWeek(opts.year, opts.isoWeek, 7),
      isoYear: opts.year,
      isoWeek: opts.isoWeek,
    };
  }
  let end = opts.weekEnd && parseYmd(opts.weekEnd) ? opts.weekEnd : '';
  if (!end) {
    const today = new Date().toISOString().slice(0, 10);
    const day = new Date(`${today}T00:00:00Z`).getUTCDay();
    const monday = addDays(today, -(day === 0 ? 6 : day - 1));
    end = addDays(monday, -1);
  }
  const start = addDays(end, -6);
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const isoWeek = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { start, end, isoYear: date.getUTCFullYear(), isoWeek };
}

function mapSnapshot(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: Number(row.id),
    snapshot_on: dateIso(row.snapshot_on),
    balance_vnd: Number(row.balance_vnd ?? 0),
    source: String(row.source ?? 'manual'),
    notes: String(row.notes ?? ''),
    updated_at: timestampIso(row.updated_at),
  };
}

function ragHigherBetter(value: number, target: number): string {
  if (value >= target) return RAG_GREEN;
  return value >= target * 0.85 ? RAG_YELLOW : RAG_RED;
}

function ragLowerBetter(value: number, target: number): string {
  if (value <= target) return RAG_GREEN;
  return value <= target * 1.15 ? RAG_YELLOW : RAG_RED;
}

function metric(opts: Record<string, unknown>): Record<string, unknown> {
  return { status_label: RAG_LABELS[String(opts.status)] ?? String(opts.status), format: opts.fmt ?? 'number', ...opts };
}

function preExecution(blocks: Record<string, Record<string, unknown>>): Record<string, unknown> {
  const actions: Record<string, unknown>[] = [];
  for (const blockKey of BLOCK_KEYS) {
    const block = blocks[blockKey];
    for (const item of (block?.metrics as Record<string, unknown>[]) ?? []) {
      const status = String(item.status ?? RAG_GREEN);
      if (status === RAG_GREEN) continue;
      actions.push({
        metric_key: item.key,
        metric_label: item.label,
        block: blockKey,
        block_label: block.label,
        status,
        status_label: item.status_label,
        hint: item.note ?? '',
        steps: [],
      });
    }
  }
  return {
    actions,
    action_count: actions.length,
    red_count: actions.filter((item) => item.status === RAG_RED).length,
    yellow_count: actions.filter((item) => item.status === RAG_YELLOW).length,
  };
}

@Injectable()
export class OwnerWeeklyPgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private schemaReady: Promise<void> | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
    this.schemaReady = null;
  }

  private async ensureSchema(): Promise<void> {
    if (!this.schemaReady) this.schemaReady = this.bootstrapSchema();
    await this.schemaReady;
  }

  private async bootstrapSchema(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS crm_owner_cash_snapshots (
        id BIGSERIAL PRIMARY KEY,
        snapshot_on DATE NOT NULL UNIQUE,
        balance_vnd BIGINT NOT NULL DEFAULT 0,
        source VARCHAR(20) NOT NULL DEFAULT 'manual',
        notes TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_owner_cash_snapshots_on
        ON crm_owner_cash_snapshots (snapshot_on DESC);
      CREATE TABLE IF NOT EXISTS crm_finance_kpi_config (
        config_key TEXT PRIMARY KEY,
        thresholds_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  async configGet(): Promise<Record<string, unknown>> {
    return {
      targets: await this.getTargets(),
      defaults: OWNER_WEEKLY_TARGET_DEFAULTS,
      labels: OWNER_WEEKLY_TARGET_LABELS,
      env_keys: OWNER_WEEKLY_ENV_KEYS,
      target_groups: OWNER_WEEKLY_TARGET_GROUPS,
    };
  }

  async configPatch(updates: Record<string, unknown>): Promise<Record<string, unknown>> {
    const targets = await this.getTargets();
    for (const [key, value] of Object.entries(updates)) {
      if (!(key in OWNER_WEEKLY_TARGET_DEFAULTS)) continue;
      const defaultValue = OWNER_WEEKLY_TARGET_DEFAULTS[key]!;
      const number = Number(value);
      targets[key] = Number.isInteger(defaultValue) ? Math.max(0, Math.trunc(number)) : number;
    }
    await this.ensureSchema();
    await this.db.query(
      `INSERT INTO crm_finance_kpi_config (config_key, thresholds_json, updated_at)
       VALUES ('owner_weekly', $1::jsonb, NOW())
       ON CONFLICT (config_key) DO UPDATE SET thresholds_json = EXCLUDED.thresholds_json, updated_at = NOW()`,
      [JSON.stringify(targets)],
    );
    return { ok: true, targets };
  }

  async listCashSnapshots(limit: number): Promise<Record<string, unknown>> {
    await this.ensureSchema();
    const result = await this.db.query(
      `SELECT id, snapshot_on, balance_vnd, source, notes, updated_at
       FROM crm_owner_cash_snapshots ORDER BY snapshot_on DESC LIMIT $1`,
      [Math.max(1, limit)],
    );
    return { snapshots: result.rows.map((row) => mapSnapshot(row as Record<string, unknown>)) };
  }

  async upsertCashSnapshot(
    snapshotOn: string,
    balanceVnd: number,
    source: string,
    notes: string,
  ): Promise<Record<string, unknown>> {
    const snapshot = parseYmd(snapshotOn);
    if (!snapshot) throw new Error('snapshot_on không hợp lệ (YYYY-MM-DD).');
    const normalizedSource = CASH_SOURCES.has(source) ? source : 'manual';
    await this.ensureSchema();
    const result = await this.db.query(
      `INSERT INTO crm_owner_cash_snapshots (snapshot_on, balance_vnd, source, notes, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (snapshot_on) DO UPDATE SET
         balance_vnd = EXCLUDED.balance_vnd,
         source = EXCLUDED.source,
         notes = EXCLUDED.notes,
         updated_at = NOW()
       RETURNING id, snapshot_on, balance_vnd, source, notes, updated_at`,
      [snapshot, Math.trunc(balanceVnd), normalizedSource, String(notes || '').trim()],
    );
    return { ok: true, snapshot: mapSnapshot(result.rows[0] as Record<string, unknown>) };
  }

  async deleteCashSnapshot(snapshotOn: string): Promise<Record<string, unknown>> {
    const snapshot = parseYmd(snapshotOn);
    if (!snapshot) throw new Error('snapshot_on không hợp lệ.');
    await this.ensureSchema();
    const result = await this.db.query(
      'DELETE FROM crm_owner_cash_snapshots WHERE snapshot_on = $1',
      [snapshot],
    );
    return { ok: true, deleted: Number(result.rowCount ?? 0) > 0 };
  }

  async dashboard(opts: WeekOptions): Promise<Record<string, unknown>> {
    const bounds = resolveWeekBounds(opts);
    const [targets, cashPosition, cashIn, cashOut, delivery, presales, arOverdue, snapshots] =
      await Promise.all([
        this.getTargets(),
        this.getCashPosition(bounds.end),
        this.sumPayments(bounds.start, bounds.end),
        this.sumExpenses(bounds.start, bounds.end),
        this.sumExpenses(bounds.start, bounds.end, 'delivery'),
        this.sumExpenses(bounds.start, bounds.end, 'presales'),
        this.sumArOverdue(bounds.end),
        this.snapshotRows(8),
      ]);
    const grossMargin = cashIn > 0 ? Math.round(((cashIn - delivery) / cashIn) * 1000) / 10 : 0;
    const netMargin = cashIn > 0
      ? Math.round(((cashIn - delivery - presales) / cashIn) * 1000) / 10
      : 0;
    const blocks: Record<string, Record<string, unknown>> = {
      cash: {
        key: 'cash',
        label: BLOCK_LABELS.cash,
        metrics: [
          metric({ key: 'cash_close', label: 'Tiền cuối tuần', value: cashPosition.position_vnd, fmt: 'vnd', status: ragHigherBetter(Number(cashPosition.position_vnd), targets.cash_safe_min_vnd!), target: targets.cash_safe_min_vnd }),
          metric({ key: 'cash_in', label: 'Thu tuần', value: cashIn, fmt: 'vnd', status: ragHigherBetter(cashIn, targets.revenue_target_vnd!), target: targets.revenue_target_vnd }),
          metric({ key: 'ar_overdue', label: 'AR quá hạn', value: arOverdue, fmt: 'vnd', status: ragLowerBetter(arOverdue, targets.ar_overdue_max_vnd!), target: targets.ar_overdue_max_vnd }),
        ],
      },
      sales: {
        key: 'sales',
        label: BLOCK_LABELS.sales,
        metrics: [
          metric({ key: 'revenue_actual', label: 'Doanh thu tuần', value: cashIn, fmt: 'vnd', status: ragHigherBetter(cashIn, targets.revenue_target_vnd!), target: targets.revenue_target_vnd }),
          metric({ key: 'win_rate', label: 'Win rate (tuần)', value: 0, fmt: 'pct', status: RAG_GREEN, target: targets.close_rate_target_pct, note: 'MVP — simplified' }),
        ],
      },
      efficiency: {
        key: 'efficiency',
        label: BLOCK_LABELS.efficiency,
        metrics: [
          metric({ key: 'gross_margin', label: 'Gross margin', value: grossMargin, fmt: 'pct', status: ragHigherBetter(grossMargin, targets.gross_margin_target_pct!), target: targets.gross_margin_target_pct }),
          metric({ key: 'net_margin', label: 'Net margin', value: netMargin, fmt: 'pct', status: ragHigherBetter(netMargin, targets.net_margin_target_pct!), target: targets.net_margin_target_pct }),
        ],
      },
      risk: {
        key: 'risk',
        label: BLOCK_LABELS.risk,
        metrics: [
          metric({ key: 'top_customer_share', label: 'Tỷ trọng DT khách lớn nhất', value: 0, fmt: 'pct', status: RAG_GREEN, target: targets.top1_share_max_pct, note: 'MVP — simplified' }),
        ],
      },
    };
    const allMetrics = BLOCK_KEYS.flatMap(
      (key) => (blocks[key]?.metrics as Record<string, unknown>[]) ?? [],
    );
    const dashboard: Record<string, unknown> = {
      week: {
        iso_year: bounds.isoYear,
        iso_week: bounds.isoWeek,
        start: bounds.start,
        end: bounds.end,
        label: `Tuần ${bounds.isoWeek}/${bounds.isoYear} (${this.formatDdMm(bounds.start)} – ${this.formatDdMm(bounds.end)})`,
      },
      blocks,
      targets,
      rag_counts: {
        [RAG_GREEN]: allMetrics.filter((item) => item.status === RAG_GREEN).length,
        [RAG_YELLOW]: allMetrics.filter((item) => item.status === RAG_YELLOW).length,
        [RAG_RED]: allMetrics.filter((item) => item.status === RAG_RED).length,
      },
      rag_legend: RAG_LABELS,
      cash_ledger: {
        position_source: cashPosition.source,
        has_snapshot: cashPosition.source === 'ledger',
        latest_snapshot: cashPosition.snapshot,
        snapshots,
        forecast: { forecast_vnd: cashPosition.position_vnd, as_of: bounds.end, method: 'mvp_stub' },
      },
      trends: { weeks: opts.trendWeeks ?? 8, labels: [], cash_close_vnd: [] },
      retention_weekly: { customer_churn_pct: 0 },
    };
    dashboard.pre_execution = preExecution(blocks);
    return dashboard;
  }

  async export(opts: WeekOptions): Promise<Record<string, unknown>> {
    const dashboard = await this.dashboard(opts);
    const week = dashboard.week as Record<string, unknown>;
    const stamp = new Date().toISOString().slice(0, 10);
    return {
      filename: `owner-weekly-${String(week.iso_year).padStart(4, '0')}-W${String(week.iso_week).padStart(2, '0')}-${stamp}.json`,
      format: 'json',
      sheets: this.buildExportSheets(dashboard),
    };
  }

  async alertCron(isoYear?: number | null, isoWeek?: number | null): Promise<Record<string, unknown>> {
    const bounds = isoYear != null && isoWeek != null
      ? resolveWeekBounds({ year: isoYear, isoWeek })
      : resolveWeekBounds({});
    const dashboard = await this.dashboard({ year: bounds.isoYear, isoWeek: bounds.isoWeek });
    const brief = dashboard.pre_execution as Record<string, unknown>;
    return {
      ok: true,
      stub: true,
      iso_year: bounds.isoYear,
      iso_week: bounds.isoWeek,
      red_count: brief.red_count ?? 0,
      yellow_count: brief.yellow_count ?? 0,
    };
  }

  async inboxSync(isoYear?: number | null, isoWeek?: number | null): Promise<Record<string, unknown>> {
    const bounds = isoYear != null && isoWeek != null
      ? resolveWeekBounds({ year: isoYear, isoWeek })
      : resolveWeekBounds({});
    const dashboard = await this.dashboard({ year: bounds.isoYear, isoWeek: bounds.isoWeek });
    const brief = dashboard.pre_execution as Record<string, unknown>;
    return {
      ok: true,
      inbox: {
        iso_year: bounds.isoYear,
        iso_week: bounds.isoWeek,
        period_ref: bounds.isoYear * 100 + bounds.isoWeek,
        synced: Number(brief.action_count ?? 0),
        removed: 0,
        action_count: Number(brief.action_count ?? 0),
        red_count: Number(brief.red_count ?? 0),
        yellow_count: Number(brief.yellow_count ?? 0),
        stub: true,
      },
    };
  }

  async inboxSummary(): Promise<Record<string, unknown>> {
    const exists = await this.db.query(`SELECT to_regclass('public.crm_reminders') AS table_name`);
    if (!exists.rows[0]?.table_name) {
      return { pending_count: 0, critical_count: 0, warning_count: 0, items: [] };
    }
    const result = await this.db.query(
      `SELECT id, title, body, remind_at, status, meta_json
       FROM crm_reminders
       WHERE scope = 'owner_weekly' AND reminder_kind = 'owner_weekly_alert' AND status = 'pending'
       ORDER BY remind_at ASC, id ASC LIMIT 100`,
    );
    let critical = 0;
    let warning = 0;
    const items = result.rows.map((row) => {
      let meta: Record<string, unknown> = {};
      try {
        const raw = (row as Record<string, unknown>).meta_json;
        meta = typeof raw === 'string' ? JSON.parse(raw) as Record<string, unknown> : (raw ?? {}) as Record<string, unknown>;
      } catch {
        meta = {};
      }
      const level = String(meta.level ?? '');
      if (level === 'critical') critical += 1;
      else warning += 1;
      return {
        id: Number(row.id),
        title: row.title ?? '',
        body: row.body ?? '',
        remind_at: timestampIso(row.remind_at),
        level,
        dashboard_url: meta.dashboard_url ?? '',
        iso_year: meta.iso_year,
        iso_week: meta.iso_week,
        metric_key: meta.metric_key,
      };
    });
    return { pending_count: items.length, critical_count: critical, warning_count: warning, items };
  }

  private async getTargets(): Promise<Record<string, number>> {
    await this.ensureSchema();
    const result = await this.db.query(
      `SELECT thresholds_json FROM crm_finance_kpi_config
       WHERE config_key = 'owner_weekly' LIMIT 1`,
    );
    const raw = result.rows[0]?.thresholds_json;
    const stored = raw && typeof raw === 'object' && !Array.isArray(raw)
      ? raw as Record<string, unknown>
      : {};
    const targets: Record<string, number> = {};
    for (const [key, defaultValue] of Object.entries(OWNER_WEEKLY_TARGET_DEFAULTS)) {
      const storedNumber = Number(stored[key]);
      if (key in stored && Number.isFinite(storedNumber)) {
        targets[key] = storedNumber;
        continue;
      }
      const envValue = Number(process.env[OWNER_WEEKLY_ENV_KEYS[key]!]);
      targets[key] = Number.isFinite(envValue) ? envValue : defaultValue;
    }
    return targets;
  }

  private async snapshotRows(limit: number): Promise<Record<string, unknown>[]> {
    const result = await this.listCashSnapshots(limit);
    return result.snapshots as Record<string, unknown>[];
  }

  private async getCashPosition(asOf: string): Promise<Record<string, unknown>> {
    await this.ensureSchema();
    const result = await this.db.query(
      `SELECT id, snapshot_on, balance_vnd, source, notes, updated_at
       FROM crm_owner_cash_snapshots
       WHERE snapshot_on <= $1 ORDER BY snapshot_on DESC LIMIT 1`,
      [asOf],
    );
    if (!result.rows[0]) {
      return {
        as_of: asOf,
        position_vnd: await this.proxyCashPosition(asOf),
        source: 'proxy',
        snapshot: null,
        flow_adjustment_vnd: 0,
      };
    }
    const snapshot = mapSnapshot(result.rows[0] as Record<string, unknown>);
    const snapshotOn = String(snapshot.snapshot_on);
    const base = Number(snapshot.balance_vnd);
    if (snapshotOn >= asOf) {
      return { as_of: asOf, position_vnd: base, source: 'ledger', snapshot, flow_adjustment_vnd: 0 };
    }
    const start = addDays(snapshotOn, 1);
    const [cashIn, cashOut] = await Promise.all([
      this.sumPayments(start, asOf),
      this.sumExpenses(start, asOf),
    ]);
    return {
      as_of: asOf,
      position_vnd: base + cashIn - cashOut,
      source: 'ledger',
      snapshot,
      flow_adjustment_vnd: cashIn - cashOut,
      flow_cash_in_vnd: cashIn,
      flow_cash_out_vnd: cashOut,
    };
  }

  private async proxyCashPosition(asOf: string): Promise<number> {
    try {
      const result = await this.db.query(
        `SELECT
           COALESCE((SELECT SUM(amount_vnd) FROM crm_svc_payments
             WHERE status = 'received' AND received_on::date <= $1::date), 0)::bigint
           - COALESCE((SELECT SUM(amount_vnd) FROM crm_svc_expenses
             WHERE expense_on::date <= $1::date), 0)::bigint AS value`,
        [asOf],
      );
      return Number(result.rows[0]?.value ?? 0);
    } catch {
      return 0;
    }
  }

  private async sumPayments(start: string, end: string): Promise<number> {
    if (start > end) return 0;
    try {
      const result = await this.db.query(
        `SELECT COALESCE(SUM(amount_vnd), 0)::bigint AS value
         FROM crm_svc_payments
         WHERE status = 'received' AND received_on::date BETWEEN $1::date AND $2::date`,
        [start, end],
      );
      return Number(result.rows[0]?.value ?? 0);
    } catch {
      return 0;
    }
  }

  private async sumExpenses(start: string, end: string, phase?: string): Promise<number> {
    if (start > end) return 0;
    try {
      const params = phase ? [start, end, phase] : [start, end];
      const phaseClause = phase ? ` AND COALESCE(NULLIF(cost_phase, ''), 'delivery') = $3` : '';
      const result = await this.db.query(
        `SELECT COALESCE(SUM(amount_vnd), 0)::bigint AS value
         FROM crm_svc_expenses
         WHERE expense_on::date BETWEEN $1::date AND $2::date${phaseClause}`,
        params,
      );
      return Number(result.rows[0]?.value ?? 0);
    } catch {
      return 0;
    }
  }

  private async sumArOverdue(asOf: string): Promise<number> {
    try {
      const result = await this.db.query(
        `SELECT
           COALESCE((SELECT SUM(amount_vnd) FROM crm_svc_payments
             WHERE status = 'pending'
               AND COALESCE(due_on::date, received_on::date) < $1::date), 0)::bigint
           + COALESCE((SELECT SUM(GREATEST(amount_vnd - COALESCE(paid_vnd, 0), 0))
             FROM crm_invoices
             WHERE status IN ('issued', 'partial', 'overdue') AND due_on::date < $1::date), 0)::bigint
           AS value`,
        [asOf],
      );
      return Number(result.rows[0]?.value ?? 0);
    } catch {
      return 0;
    }
  }

  private formatDdMm(iso: string): string {
    const [, month, day] = iso.split('-');
    return `${day}/${month}`;
  }

  private buildExportSheets(dashboard: Record<string, unknown>): Array<Record<string, unknown>> {
    const week = dashboard.week as Record<string, unknown>;
    const brief = dashboard.pre_execution as Record<string, unknown>;
    const rag = dashboard.rag_counts as Record<string, number>;
    const details: unknown[][] = [];
    const blocks = dashboard.blocks as Record<string, Record<string, unknown>>;
    for (const key of BLOCK_KEYS) {
      for (const item of (blocks[key]?.metrics as Record<string, unknown>[]) ?? []) {
        details.push([
          blocks[key]?.label ?? key,
          item.label ?? item.key,
          this.formatExportValue(item.value, item.format),
          item.target != null ? this.formatExportValue(item.target, item.format) : '',
          item.status_label ?? item.status,
          item.delta_pct ?? '',
          item.note ?? '',
        ]);
      }
    }
    const actions = ((brief.actions as Record<string, unknown>[]) ?? []).map((item) => [
      item.block_label ?? '',
      item.metric_label ?? '',
      item.status_label ?? item.status ?? '',
      item.hint ?? '',
      ((item.steps as unknown[]) ?? []).slice(0, 5).map(String).join(' | '),
    ]);
    return [
      {
        name: 'Tom tat',
        headers: ['Chỉ số', 'Giá trị'],
        rows: [
          ['Tuần', week.label ?? ''],
          ['Bắt đầu', week.start ?? ''],
          ['Kết thúc', week.end ?? ''],
          ['Chỉ số xanh', rag[RAG_GREEN] ?? 0],
          ['Chỉ số vàng', rag[RAG_YELLOW] ?? 0],
          ['Chỉ số đỏ', rag[RAG_RED] ?? 0],
          ['Hành động cần xử lý', brief.action_count ?? 0],
        ],
      },
      {
        name: 'Chi tiet',
        headers: ['Khối', 'Chỉ số', 'Giá trị', 'Target', 'Trạng thái', 'So tuần trước (%)', 'Ghi chú'],
        rows: details,
      },
      {
        name: 'Hanh dong',
        headers: ['Khối', 'Chỉ số', 'Mức', 'Gợi ý', 'Bước điều tra'],
        rows: actions,
      },
    ];
  }

  private formatExportValue(value: unknown, format: unknown): string {
    if (format === 'vnd') return Number(value ?? 0).toLocaleString('vi-VN').replace(/,/g, '.');
    if (format === 'pct') return `${value}%`;
    if (format === 'ratio') return `${value}×`;
    if (format === 'days') return `${value} ngày`;
    return String(value ?? '');
  }
}
