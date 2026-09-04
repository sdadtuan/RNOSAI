import {
  KPI_HUB_DASHBOARD,
  KPI_HUB_DICT_SUMMARY,
  KPI_HUB_DICTIONARY,
  KPI_HUB_QUALITY,
  KPI_HUB_REPORTS,
  KPI_HUB_TARGETS,
  KPI_HUB_WORKSPACE,
  type KpiHubDictionaryRow,
} from './kpi-hub-fixtures';
import type {
  KpiHubDashboardData,
  KpiHubDictSummary,
  KpiHubTargetsData,
} from './kpi-hub-types';

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function mapDictRow(raw: unknown): KpiHubDictionaryRow | null {
  const r = asRecord(raw);
  if (!r) return null;
  const code = str(r.code);
  if (!code) return null;
  const group = str(r.group, 'ACQUISITION') as KpiHubDictionaryRow['group'];
  return {
    id: str(r.id, code.toLowerCase()),
    code,
    name: str(r.name, code),
    group,
    groupLabel: str(r.groupLabel, str(r.group_label, group)),
    groupColor: str(r.groupColor, str(r.group_color, '#3b82f6')),
    source: str(r.source),
    frequency: str(r.frequency),
    dataOwner: str(r.dataOwner, str(r.data_owner)),
    status: (str(r.status, 'DRAFT') as KpiHubDictionaryRow['status']),
    direction: (str(r.direction, 'HIGHER_IS_BETTER') as KpiHubDictionaryRow['direction']),
    unit: r.unit != null ? str(r.unit) : undefined,
    formulaDisplay: r.formulaDisplay != null ? str(r.formulaDisplay, str(r.formula_display)) : undefined,
    targetValue: r.targetValue != null ? num(r.targetValue, num(r.target_value)) : undefined,
    targetLabel: r.targetLabel != null ? str(r.targetLabel, str(r.target_label)) : undefined,
    numeratorCode: r.numeratorCode != null ? str(r.numeratorCode, str(r.numerator_code)) : undefined,
    numeratorLabel: r.numeratorLabel != null ? str(r.numeratorLabel, str(r.numerator_label)) : undefined,
    denominatorCode: r.denominatorCode != null ? str(r.denominatorCode, str(r.denominator_code)) : undefined,
    denominatorLabel: r.denominatorLabel != null ? str(r.denominatorLabel, str(r.denominator_label)) : undefined,
  };
}

export function normalizeDashboard(raw: Record<string, unknown>): KpiHubDashboardData {
  const cards = asArray(raw.cards);
  if (!cards.length) return KPI_HUB_DASHBOARD;

  return {
    periodLabel: str(raw.periodLabel, str(raw.period_label, KPI_HUB_DASHBOARD.periodLabel)),
    cards: cards.map((c) => {
      const row = asRecord(c) ?? {};
      return {
        code: str(row.code),
        name: str(row.name),
        value: num(row.value),
        formatted: str(row.formatted, String(row.value ?? '')),
        deltaPct: row.deltaPct != null ? num(row.deltaPct, num(row.delta_pct)) : undefined,
        target: row.target != null ? num(row.target) : undefined,
        status: str(row.status, 'NO_STATUS'),
        badge: str(row.badge, str(row.status)),
        formulaDisplay: row.formulaDisplay != null ? str(row.formulaDisplay, str(row.formula_display)) : undefined,
        sourceStatus: row.sourceStatus != null ? str(row.sourceStatus, str(row.source_status)) : undefined,
        breakdown: asArray(row.breakdown).map((b) => {
          const item = asRecord(b) ?? {};
          return {
            label: str(item.label),
            value: str(item.value),
            pct: item.pct != null ? num(item.pct) : undefined,
          };
        }),
      };
    }),
    funnel: asRecord(raw.funnel)
      ? {
          stages: asArray(asRecord(raw.funnel)?.stages).map((s) => {
            const stage = asRecord(s) ?? {};
            return {
              code: str(stage.code),
              name: str(stage.name),
              value: num(stage.value),
              conversion: stage.conversion != null ? str(stage.conversion) : undefined,
            };
          }),
          bottleneck: {
            code: str(asRecord(asRecord(raw.funnel)?.bottleneck)?.code),
            label: str(asRecord(asRecord(raw.funnel)?.bottleneck)?.label),
          },
        }
      : KPI_HUB_DASHBOARD.funnel,
    targetProgress: asRecord(raw.targetProgress ?? raw.target_progress)
      ? {
          overallPct: num(
            asRecord(raw.targetProgress ?? raw.target_progress)?.overallPct,
            num(asRecord(raw.targetProgress ?? raw.target_progress)?.overall_pct, KPI_HUB_DASHBOARD.targetProgress.overallPct),
          ),
          groups: asArray(asRecord(raw.targetProgress ?? raw.target_progress)?.groups).map((g) => {
            const group = asRecord(g) ?? {};
            return {
              code: str(group.code),
              label: str(group.label),
              pct: num(group.pct),
            };
          }),
        }
      : KPI_HUB_DASHBOARD.targetProgress,
    channels: asArray(raw.channels).length
      ? asArray(raw.channels).map((c) => {
          const ch = asRecord(c) ?? {};
          return {
            channel: str(ch.channel),
            validLeads: num(ch.validLeads, num(ch.valid_leads)),
            revenue: num(ch.revenue),
          };
        })
      : KPI_HUB_DASHBOARD.channels,
    alerts: asArray(raw.alerts).length
      ? asArray(raw.alerts).map((a) => {
          const alert = asRecord(a) ?? {};
          return {
            level: str(alert.level),
            title: str(alert.title),
            scope: str(alert.scope),
            age: alert.age != null ? str(alert.age) : undefined,
          };
        })
      : KPI_HUB_DASHBOARD.alerts,
    topSales: asArray(raw.topSales ?? raw.top_sales).length
      ? asArray(raw.topSales ?? raw.top_sales).map((s) => {
          const sale = asRecord(s) ?? {};
          return {
            rank: num(sale.rank),
            name: str(sale.name),
            revenue: num(sale.revenue),
            winRate: num(sale.winRate, num(sale.win_rate)),
          };
        })
      : KPI_HUB_DASHBOARD.topSales,
  };
}

export function normalizeDictionaryList(raw: Record<string, unknown>): {
  data: KpiHubDictionaryRow[];
  summary: KpiHubDictSummary;
} {
  const rows = asArray(raw.data).map(mapDictRow).filter(Boolean) as KpiHubDictionaryRow[];
  const summaryRaw = asRecord(raw.summary);
  const summary: KpiHubDictSummary = summaryRaw
    ? {
        total: num(summaryRaw.total, KPI_HUB_DICT_SUMMARY.total),
        active: num(summaryRaw.active, KPI_HUB_DICT_SUMMARY.active),
        needReview: num(summaryRaw.needReview, num(summaryRaw.need_review, KPI_HUB_DICT_SUMMARY.needReview)),
        sources: num(summaryRaw.sources, KPI_HUB_DICT_SUMMARY.sources),
      }
    : KPI_HUB_DICT_SUMMARY;

  return {
    data: rows.length ? rows : KPI_HUB_DICTIONARY,
    summary: rows.length ? summary : KPI_HUB_DICT_SUMMARY,
  };
}

export function normalizeTargets(raw: Record<string, unknown>): KpiHubTargetsData {
  const rows = asArray(raw.data);
  if (!rows.length) return KPI_HUB_TARGETS as KpiHubTargetsData;

  const summaryRaw = asRecord(raw.summary);
  return {
    summary: summaryRaw
      ? {
          configured: num(summaryRaw.configured, KPI_HUB_TARGETS.summary.configured),
          total: num(summaryRaw.total, KPI_HUB_TARGETS.summary.total),
          achievedPct: num(summaryRaw.achievedPct, num(summaryRaw.achieved_pct, KPI_HUB_TARGETS.summary.achievedPct)),
          warning: num(summaryRaw.warning, KPI_HUB_TARGETS.summary.warning),
          critical: num(summaryRaw.critical, KPI_HUB_TARGETS.summary.critical),
        }
      : KPI_HUB_TARGETS.summary,
    rows: rows.map((r) => {
      const row = asRecord(r) ?? {};
      return {
        id: str(row.id),
        code: str(row.code),
        name: str(row.name),
        actual: num(row.actual),
        actualFmt: str(row.actualFmt, str(row.actual_fmt, String(row.actual ?? ''))),
        target: num(row.target),
        targetFmt: str(row.targetFmt, str(row.target_fmt, String(row.target ?? ''))),
        warning: row.warning != null ? num(row.warning) : null,
        critical: row.critical != null ? num(row.critical) : null,
        trend: (str(row.trend, 'flat') as 'up' | 'down' | 'flat'),
        status: str(row.status, 'NO_STATUS'),
        scopeLevel: row.scopeLevel != null ? (str(row.scopeLevel, str(row.scope_level)) as KpiHubTargetsData['rows'][0]['scopeLevel']) : undefined,
        scopeLabel: row.scopeLabel != null ? str(row.scopeLabel, str(row.scope_label)) : undefined,
      };
    }),
  };
}

export function normalizeQuality(raw: Record<string, unknown>) {
  if (raw.score == null && raw.sourcesOk == null && raw.sources_ok == null) return KPI_HUB_QUALITY;
  return {
    score: num(raw.score, KPI_HUB_QUALITY.score),
    sourcesOk: num(raw.sourcesOk, num(raw.sources_ok, KPI_HUB_QUALITY.sourcesOk)),
    sourcesTotal: num(raw.sourcesTotal, num(raw.sources_total, KPI_HUB_QUALITY.sourcesTotal)),
    warnings: num(raw.warnings, KPI_HUB_QUALITY.warnings),
    critical: num(raw.critical, KPI_HUB_QUALITY.critical),
    trend: asArray(raw.trend).length ? asArray(raw.trend).map((v) => num(v)) : KPI_HUB_QUALITY.trend,
    freshness: asArray(raw.freshness).length
      ? asArray(raw.freshness).map((f) => {
          const item = asRecord(f) ?? {};
          return {
            name: str(item.name),
            status: str(item.status, 'UNKNOWN') as 'FRESH' | 'DELAYED' | 'FAILED' | 'UNKNOWN',
            lag: str(item.lag),
          };
        })
      : KPI_HUB_QUALITY.freshness,
    rules: asArray(raw.rules).length
      ? asArray(raw.rules).map((r) => {
          const rule = asRecord(r) ?? {};
          return {
            id: str(rule.id),
            name: str(rule.name),
            severity: str(rule.severity),
            passRate: num(rule.passRate, num(rule.pass_rate)),
            status: str(rule.status),
          };
        })
      : KPI_HUB_QUALITY.rules,
    issue: asRecord(raw.issue)
      ? {
          id: str(asRecord(raw.issue)?.id),
          rule: str(asRecord(raw.issue)?.rule),
          count: num(asRecord(raw.issue)?.count),
          sample: str(asRecord(raw.issue)?.sample),
          assignee: asRecord(raw.issue)?.assignee != null ? str(asRecord(raw.issue)?.assignee) : null,
        }
      : KPI_HUB_QUALITY.issue,
  };
}

export function normalizeReports(raw: Record<string, unknown>) {
  const items = asArray(raw.data);
  if (!items.length && !asRecord(raw.summary)) return KPI_HUB_REPORTS;

  const summaryRaw = asRecord(raw.summary);
  return {
    summary: summaryRaw
      ? {
          total: num(summaryRaw.total, KPI_HUB_REPORTS.summary.total),
          mine: num(summaryRaw.mine, KPI_HUB_REPORTS.summary.mine),
          shared: num(summaryRaw.shared, KPI_HUB_REPORTS.summary.shared),
          sentThisMonth: num(summaryRaw.sentThisMonth, num(summaryRaw.sent_this_month, KPI_HUB_REPORTS.summary.sentThisMonth)),
        }
      : KPI_HUB_REPORTS.summary,
    tabs: KPI_HUB_REPORTS.tabs,
    items: items.length
      ? items.map((i) => {
          const item = asRecord(i) ?? {};
          return {
            id: str(item.id),
            name: str(item.name),
            type: str(item.type),
            owner: str(item.owner),
            status: str(item.status),
          };
        })
      : KPI_HUB_REPORTS.items,
    quickCreate: KPI_HUB_REPORTS.quickCreate,
    nextSchedule: KPI_HUB_REPORTS.nextSchedule,
    recentShares: KPI_HUB_REPORTS.recentShares,
  };
}

export function normalizeWorkspace(raw: Record<string, unknown>) {
  if (!raw.name) return KPI_HUB_WORKSPACE;
  return {
    name: str(raw.name, KPI_HUB_WORKSPACE.name),
    company: str(raw.company, KPI_HUB_WORKSPACE.company),
    timezone: str(raw.timezone, KPI_HUB_WORKSPACE.timezone),
    locale: str(raw.locale, KPI_HUB_WORKSPACE.locale),
    currency: str(raw.currency, KPI_HUB_WORKSPACE.currency),
    weekStart: str(raw.weekStart, str(raw.week_start, KPI_HUB_WORKSPACE.weekStart)),
    defaultPeriodGrain: str(raw.defaultPeriodGrain, str(raw.default_period_grain, KPI_HUB_WORKSPACE.defaultPeriodGrain)),
    closeDay: num(raw.closeDay, num(raw.close_day, KPI_HUB_WORKSPACE.closeDay)),
    reconcileDay: num(raw.reconcileDay, num(raw.reconcile_day, KPI_HUB_WORKSPACE.reconcileDay)),
    lockClosedPeriods: Boolean(raw.lockClosedPeriods ?? raw.lock_closed_periods ?? KPI_HUB_WORKSPACE.lockClosedPeriods),
    allowReopen: Boolean(raw.allowReopen ?? raw.allow_reopen ?? KPI_HUB_WORKSPACE.allowReopen),
    requireKpiApproval: Boolean(raw.requireKpiApproval ?? raw.require_kpi_approval ?? KPI_HUB_WORKSPACE.requireKpiApproval),
    autoQuality: Boolean(raw.autoQuality ?? raw.auto_quality ?? KPI_HUB_WORKSPACE.autoQuality),
    alertsEnabled: Boolean(raw.alertsEnabled ?? raw.alerts_enabled ?? KPI_HUB_WORKSPACE.alertsEnabled),
    maintenanceMode: Boolean(raw.maintenanceMode ?? raw.maintenance_mode ?? KPI_HUB_WORKSPACE.maintenanceMode),
  };
}

export function dashboardFiltersToQuery(filters: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.department) out.department = filters.department;
  if (filters.channel) out.channel = filters.channel;
  if (filters.product) out.product = filters.product;
  if (filters.team) out.team = filters.team;
  return out;
}
