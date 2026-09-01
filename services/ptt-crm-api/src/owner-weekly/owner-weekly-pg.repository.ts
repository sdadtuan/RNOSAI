import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  computeSpaMeta24hSlas,
  parseB2CompletedAt,
} from '../cskh-board/cskh-board-sla.util';
import { computeK1, computeK2, computeK3, computeK4Compliance } from '../lifecycle-milestone/lifecycle-kpi.util';
import { LIFECYCLE_MILESTONE_DDL } from '../lifecycle-milestone/lifecycle-milestone.pg.util';

const RAG_GREEN = 'green';
const RAG_YELLOW = 'yellow';
const RAG_RED = 'red';
const BLOCK_KEYS = ['cash', 'sales', 'efficiency', 'risk'] as const;
const DASHBOARD_BLOCK_KEYS = [...BLOCK_KEYS, 'lifecycle'] as const;
const LIFECYCLE_MIN_SAMPLE = 3;
const CASH_SOURCES = new Set(['manual', 'bank']);

const RAG_LABELS: Record<string, string> = {
  [RAG_GREEN]: 'Đạt / vượt target',
  [RAG_YELLOW]: 'Lệch nhẹ — theo dõi sát',
  [RAG_RED]: 'Cần xử lý trong 7 ngày',
  neutral: 'Chưa đủ mẫu / neutral',
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
  k1_b2_median_max_minutes: 480,
  k2_intake_median_max_days: 5,
  k3_client_active_max_days: 14,
  k4_first_call_min_pct: 85,
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
  k1_b2_median_max_minutes: 'K1 B2 median tối đa (phút)',
  k2_intake_median_max_days: 'K2 Intake Go median tối đa (ngày)',
  k3_client_active_max_days: 'K3 Client active median tối đa (ngày)',
  k4_first_call_min_pct: 'K4 First call 15p compliance tối thiểu (%)',
};

export const OWNER_WEEKLY_TARGET_GROUPS: Array<[string, string, string[]]> = [
  ['cash', 'Tiền', ['cash_safe_min_vnd', 'cash_forecast_min_vnd', 'ar_overdue_max_vnd', 'revenue_target_vnd']],
  ['sales', 'Kinh doanh', ['lead_new_target', 'lead_qualified_target', 'proposals_target', 'deals_closed_target', 'pipeline_next_min_vnd', 'close_rate_target_pct']],
  ['efficiency', 'Hiệu quả', ['gross_margin_target_pct', 'net_margin_target_pct', 'cac_max_vnd', 'roas_min', 'cycle_time_max_days', 'ontime_target_pct']],
  ['risk', 'Rủi ro', ['bad_debt_min_vnd', 'bad_debt_min_days', 'late_projects_max', 'stuck_work_max', 'capacity_max_util_pct', 'top_deal_share_max_pct', 'top1_share_max_pct', 'churn_max_pct', 'win_rate_drop_warn_pct', 'win_rate_drop_critical_pct']],
  ['lifecycle', 'Lifecycle', ['k1_b2_median_max_minutes', 'k2_intake_median_max_days', 'k3_client_active_max_days', 'k4_first_call_min_pct']],
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
  for (const blockKey of DASHBOARD_BLOCK_KEYS) {
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
      ${LIFECYCLE_MILESTONE_DDL}
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

  /**
   * Thin public wrapper around private loadLifecycleKpis — same computeK1…K4 SQL.
   * Do not copy KPI queries into CEO tower.
   */
  async loadLifecycleKpiStrip(): Promise<Array<{
    key: 'k1' | 'k2' | 'k3' | 'k4';
    value: number | null;
    status: 'green' | 'amber' | 'red' | 'neutral';
  }>> {
    const bounds = resolveWeekBounds({});
    const targets = await this.getTargets();
    const metrics = await this.loadLifecycleKpis(bounds.end, targets);
    const keyMap: Record<string, 'k1' | 'k2' | 'k3' | 'k4'> = {
      k1_b2_minutes: 'k1',
      k2_intake_days: 'k2',
      k3_client_active_days: 'k3',
      k4_first_call_pct: 'k4',
    };
    const out: Array<{
      key: 'k1' | 'k2' | 'k3' | 'k4';
      value: number | null;
      status: 'green' | 'amber' | 'red' | 'neutral';
    }> = [];
    for (const metric of metrics) {
      const mapped = keyMap[String(metric.key ?? '')];
      if (!mapped) continue;
      const rawStatus = String(metric.status ?? 'neutral');
      const status =
        rawStatus === 'yellow' ? 'amber'
          : rawStatus === 'green' || rawStatus === 'red' || rawStatus === 'amber' || rawStatus === 'neutral'
            ? rawStatus
            : 'neutral';
      const rawValue = metric.value;
      const value = rawValue == null || rawValue === '' ? null : Number(rawValue);
      out.push({
        key: mapped,
        value: value != null && Number.isFinite(value) ? value : null,
        status,
      });
    }
    return out;
  }

  async dashboard(opts: WeekOptions): Promise<Record<string, unknown>> {
    const bounds = resolveWeekBounds(opts);
    const targets = await this.getTargets();
    const [cashPosition, cashIn, cashOut, delivery, presales, arOverdue, snapshots, lifecycleMetrics] =
      await Promise.all([
        this.getCashPosition(bounds.end),
        this.sumPayments(bounds.start, bounds.end),
        this.sumExpenses(bounds.start, bounds.end),
        this.sumExpenses(bounds.start, bounds.end, 'delivery'),
        this.sumExpenses(bounds.start, bounds.end, 'presales'),
        this.sumArOverdue(bounds.end),
        this.snapshotRows(8),
        this.loadLifecycleKpis(bounds.end, targets),
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
      lifecycle: {
        key: 'lifecycle',
        label: 'Lifecycle (Factory A/B)',
        metrics: lifecycleMetrics,
      },
    };
    const allMetrics = DASHBOARD_BLOCK_KEYS.flatMap(
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

  private async loadLifecycleKpis(
    windowEnd: string,
    targets: Record<string, number>,
  ): Promise<Record<string, unknown>[]> {
    await this.ensureSchema();
    const windowStart = addDays(windowEnd, -89);

    const lifecycleMetric = (
      key: string,
      label: string,
      value: number | null,
      fmt: string,
      target: number,
      n: number,
      lowerIsBetter: boolean,
    ): Record<string, unknown> => {
      if (n < LIFECYCLE_MIN_SAMPLE) {
        return metric({
          key,
          label,
          value: null,
          fmt,
          status: 'neutral',
          target,
          note: `Chưa đủ mẫu (n=${n})`,
        });
      }
      if (value == null) {
        return metric({ key, label, value: null, fmt, status: 'neutral', target, note: 'Chưa có dữ liệu' });
      }
      const status = lowerIsBetter ? ragLowerBetter(value, target) : ragHigherBetter(value, target);
      return metric({ key, label, value, fmt, status, target, note: `n=${n}` });
    };

    try {
      const [k1Result, k2Result, k3Result, k4Counts] = await Promise.all([
        this.db.query(
          `SELECT l.created_at::text AS created_at, b.occurred_at::text AS b2_at
           FROM crm_lifecycle_milestones b
           JOIN crm_leads l ON l.sqlite_lead_id = b.lead_id
           WHERE b.milestone_key = 'b2_done'
             AND b.occurred_at::date BETWEEN $1::date AND $2::date
             AND EXISTS (SELECT 1 FROM crm_lead_presales ps WHERE ps.lead_id = b.lead_id)`,
          [windowStart, windowEnd],
        ),
        this.db.query(
          `SELECT b2.occurred_at::text AS b2_at, ig.occurred_at::text AS intake_at
           FROM crm_lifecycle_milestones b2
           JOIN crm_lifecycle_milestones ig
             ON ig.lead_id = b2.lead_id AND ig.milestone_key = 'intake_go'
           WHERE b2.milestone_key = 'b2_done'
             AND ig.occurred_at::date BETWEEN $1::date AND $2::date`,
          [windowStart, windowEnd],
        ),
        this.db.query(
          `SELECT ca.occurred_at::text AS contract_at, cl.occurred_at::text AS client_at
           FROM crm_lifecycle_milestones ca
           JOIN crm_lifecycle_milestones cl
             ON cl.lead_id = ca.lead_id AND cl.milestone_key = 'client_active'
           WHERE ca.milestone_key = 'contract_active'
             AND cl.occurred_at::date BETWEEN $1::date AND $2::date`,
          [windowStart, windowEnd],
        ),
        this.loadFirstCallComplianceCounts(windowStart, windowEnd),
      ]);

      const k1 = computeK1(k1Result.rows as Array<{ created_at: string; b2_at: string }>);
      const k2 = computeK2(k2Result.rows as Array<{ b2_at: string; intake_at: string }>);
      const k3 = computeK3(k3Result.rows as Array<{ contract_at: string; client_at: string }>);
      const k4 = computeK4Compliance(k4Counts);

      return [
        lifecycleMetric(
          'k1_b2_minutes',
          'K1 B2 median (phút)',
          k1.median_minutes,
          'minutes',
          targets.k1_b2_median_max_minutes!,
          k1.n,
          true,
        ),
        lifecycleMetric(
          'k2_intake_days',
          'K2 Intake Go median (ngày)',
          k2.median_days,
          'days',
          targets.k2_intake_median_max_days!,
          k2.n,
          true,
        ),
        lifecycleMetric(
          'k3_client_active_days',
          'K3 Client active median (ngày)',
          k3.median_days,
          'days',
          targets.k3_client_active_max_days!,
          k3.n,
          true,
        ),
        lifecycleMetric(
          'k4_first_call_pct',
          'K4 First call 15p (%)',
          k4.pct,
          'pct',
          targets.k4_first_call_min_pct!,
          k4.n,
          false,
        ),
      ];
    } catch {
      return [
        metric({ key: 'k1_b2_minutes', label: 'K1 B2 median (phút)', value: null, fmt: 'minutes', status: 'neutral', target: targets.k1_b2_median_max_minutes }),
        metric({ key: 'k2_intake_days', label: 'K2 Intake Go median (ngày)', value: null, fmt: 'days', status: 'neutral', target: targets.k2_intake_median_max_days }),
        metric({ key: 'k3_client_active_days', label: 'K3 Client active median (ngày)', value: null, fmt: 'days', status: 'neutral', target: targets.k3_client_active_max_days }),
        metric({ key: 'k4_first_call_pct', label: 'K4 First call 15p (%)', value: null, fmt: 'pct', status: 'neutral', target: targets.k4_first_call_min_pct }),
      ];
    }
  }

  private async loadFirstCallComplianceCounts(
    windowStart: string,
    windowEnd: string,
  ): Promise<{ ok: number; breach: number }> {
    const leadsResult = await this.db.query(
      `SELECT sqlite_lead_id, status, received_at::text AS received_at, created_at::text AS created_at,
              care_stages_done_json::text AS care_stages_done_json, updated_at::text AS updated_at
       FROM crm_leads
       WHERE created_at::date BETWEEN $1::date AND $2::date
         AND lower(COALESCE(channel, '')) IN ('spa_meta', 'facebook', 'meta')`,
      [windowStart, windowEnd],
    );
    const rows = leadsResult.rows as Array<Record<string, unknown>>;
    if (!rows.length) return { ok: 0, breach: 0 };

    const ids = rows.map((row) => Number(row.sqlite_lead_id)).filter((id) => id > 0);
    const firstCallsResult = await this.db.query(
      `SELECT lead_id, MIN(created_at)::text AS first_call_at
       FROM crm_lead_activities
       WHERE lead_id = ANY($1::bigint[]) AND activity_type = 'call'
       GROUP BY lead_id`,
      [ids],
    );
    const firstCalls = new Map<number, string>();
    for (const row of firstCallsResult.rows as Array<{ lead_id: string; first_call_at: string }>) {
      if (row.first_call_at) firstCalls.set(Number(row.lead_id), String(row.first_call_at));
    }

    let ok = 0;
    let breach = 0;
    for (const row of rows) {
      const leadId = Number(row.sqlite_lead_id);
      const careJson = row.care_stages_done_json != null ? String(row.care_stages_done_json) : null;
      const sla = computeSpaMeta24hSlas({
        status: String(row.status ?? ''),
        receivedAt: row.received_at != null ? String(row.received_at) : null,
        createdAt: String(row.created_at ?? ''),
        firstCallAt: firstCalls.get(leadId) ?? null,
        careStagesDoneJson: careJson,
        b2CompletedAt: parseB2CompletedAt(careJson),
        closedAt: null,
      });
      const tier = sla.tiers.find((item) => item.tier === 'first_call_15m');
      if (!tier || tier.sla_state === 'na') continue;
      if (tier.sla_state === 'ok') ok += 1;
      else if (tier.sla_state === 'breach') breach += 1;
    }
    return { ok, breach };
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
    if (format === 'minutes') return `${value} phút`;
    return String(value ?? '');
  }
}
