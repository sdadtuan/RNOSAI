import { Injectable, Optional } from '@nestjs/common';
import { AiNlQueryService } from '../ai-intelligence/ai-nl-query.service';
import { CrmStaffPgRepository } from '../crm-staff/crm-staff-pg.repository';
import { resolveLeadFlowKind } from '../leads-funnel/lead-flow-kind.util';
import { OwnerWeeklyPgRepository } from '../owner-weekly/owner-weekly-pg.repository';
import { withTimeout } from './ceo-command-briefing.util';
import {
  hasBoardView,
  hasContractView,
  hasCskhView,
  hasCeoFinanceView,
  hasLeadsView,
  hasOpsView,
} from './ceo-command-caps.util';
import type { CeoActor } from './ceo-command.types';
import { hasGdkdViewAllLeads } from '../staff-permissions/staff-gdkd.util';
import { isTowerUatSeed } from './ceo-tower-column.util';
import { towerDrillHref } from './ceo-tower-drill.util';
import {
  buildFinanceStrip,
  buildS11Exception,
  isS11Fail,
} from './ceo-tower-finance.util';
import { buildOrgRollup, exceptionMatchesOrgFilters } from './ceo-tower-org.util';
import { buildCapacityTop } from './ceo-tower-capacity.util';
import type { TowerRosterEntry } from './ceo-tower-capacity.util';
import { CeoTowerRepository } from './ceo-tower.repository';
import { classifyTowerRow } from './ceo-tower-sensors.util';
import type {
  TowerCandidate,
  TowerColumnId,
  TowerException,
  TowerFactory,
  TowerFinanceStrip,
  TowerPayload,
  TowerQuery,
  TowerSensorId,
  TowerSeverity,
} from './ceo-tower.types';

const SOURCE_TIMEOUT_MS = 2500;
const CACHE_TTL_MS = 60_000;
const H = 3600_000;
const D = 24 * H;
const EXCEPTION_WINDOW_MS = 7 * D;
const COLUMN_IDS: TowerColumnId[] = [
  'lead_b2', 'intake', 'consult', 'contract', 'tmmt_deliver', 'care',
];
const SENSOR_IDS: TowerSensorId[] = [
  'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12',
];
const COLUMN_LABEL_VI: Record<TowerColumnId, string> = {
  lead_b2: 'Lead/B2',
  intake: 'Intake',
  consult: 'Tư vấn',
  contract: 'HĐ',
  tmmt_deliver: 'TMMT',
  care: 'CSKH',
};

type ClassifiedRow = {
  candidate: TowerCandidate;
  factory: TowerFactory;
  column_id: TowerColumnId;
  severity: TowerSeverity;
  sensor_ids: TowerSensorId[];
  suggest_action: string | null;
  ageMs: number;
};

type CachedBundle = {
  rows: ClassifiedRow[];
  k_strip: TowerPayload['k_strip'];
  finance_strip?: TowerFinanceStrip;
  roster: TowerRosterEntry[];
  s11Fail: boolean;
  financeMetricsOk: boolean;
  degraded: TowerPayload['degraded'];
  sensors_ok: TowerPayload['sensors_ok'];
  columnDegraded: Partial<Record<TowerColumnId, string>>;
};

export type CeoTowerClock = { nowMs?: number };

@Injectable()
export class CeoTowerSensorService {
  private readonly cache = new Map<string, { exp: number; value: CachedBundle }>();
  private readonly fixedNowMs: number | undefined;

  constructor(
    private readonly repo: CeoTowerRepository,
    private readonly ownerWeekly: OwnerWeeklyPgRepository,
    @Optional() private readonly nlQuery?: AiNlQueryService,
    @Optional() clock?: CeoTowerClock,
    @Optional() private readonly crmStaff?: CrmStaffPgRepository,
  ) {
    this.fixedNowMs = clock?.nowMs;
  }

  async buildPayload(actor: CeoActor, query: TowerQuery): Promise<TowerPayload> {
    const nowMs = this.fixedNowMs ?? Date.now();
    const factoryFilter = parseFactory(query.factory);
    const viewAll = hasGdkdViewAllLeads(actor.caps);
    const cacheKey = [
      actor.staffId,
      viewAll ? 'all' : 'mine',
      factoryFilter,
      query.department ?? '',
      query.team ?? '',
      query.position_code ?? '',
      query.staff_id ?? '',
    ].join('|');

    let bundle = this.readCache(cacheKey, nowMs);
    if (!bundle) {
      bundle = await this.loadBundle(actor, {
        factoryFilter,
        department: query.department,
        team: query.team,
        position_code: query.position_code,
        staff_id: query.staff_id,
        nowMs,
      });
      this.cache.set(cacheKey, { exp: nowMs + CACHE_TTL_MS, value: bundle });
    }

    const severityWanted = parseSeverity(query.severity);
    const columnFilter = parseColumn(query.column_id);
    const limit = clampLimit(query.limit);
    const orgFilters = {
      department: query.department,
      team: query.team,
      position_code: query.position_code,
      staff_id: query.staff_id,
    };
    const baseRows = bundle.rows.filter((row) => !bundle.columnDegraded[row.column_id]);
    const filteredRows = baseRows.filter((row) =>
      exceptionMatchesOrgFilters(toException(row, nowMs), orgFilters),
    );
    const rollupSource = filteredRows.map((row) => toException(row, nowMs));
    const exceptionsAll = filteredRows
      .filter((row) => inExceptionWindow(row, nowMs))
      .filter((row) => severityWanted.has(row.severity))
      .filter((row) => !columnFilter || row.column_id === columnFilter)
      .sort(compareExceptions)
      .map((row) => toException(row, nowMs));

    if (bundle.s11Fail) {
      exceptionsAll.unshift(buildS11Exception(0));
    }

    const afterCursor = applyCursor(exceptionsAll, query.cursor);
    const page = afterCursor.slice(0, limit);
    const next = afterCursor[limit];
    const columns = buildColumns(filteredRows, bundle.columnDegraded);
    const capacityTop = buildCapacityTop(rollupSource, bundle.roster);

    return {
      ok: true,
      generated_at: new Date(nowMs).toISOString(),
      window_exception_days: 7,
      k_strip: bundle.k_strip,
      ...(bundle.finance_strip ? { finance_strip: bundle.finance_strip } : {}),
      ...(capacityTop.length ? { capacity_top: capacityTop } : {}),
      columns,
      exceptions: page,
      org_rollup: buildOrgRollup(rollupSource, { factoryFilter }),
      next_cursor: next ? `${next.entity_type}:${next.entity_id}` : null,
      degraded: bundle.degraded,
      sensors_ok: bundle.sensors_ok,
    };
  }

  private readCache(key: string, nowMs: number): CachedBundle | null {
    const hit = this.cache.get(key);
    if (!hit || hit.exp <= nowMs) {
      if (hit) this.cache.delete(key);
      return null;
    }
    return hit.value;
  }

  private async loadBundle(
    actor: CeoActor,
    opts: {
      factoryFilter: 'A' | 'B' | 'both';
      department?: string;
      team?: string;
      position_code?: string;
      staff_id?: string;
      nowMs: number;
    },
  ): Promise<CachedBundle> {
    const degraded: TowerPayload['degraded'] = [];
    const hasOps = hasOpsView(actor.caps);
    const hasLeads = hasLeadsView(actor.caps);
    const hasBoard = hasBoardView(actor.caps);
    const hasContract = hasContractView(actor.caps);
    const hasCskh = hasCskhView(actor.caps);
    const hasKStrip = actor.caps.some(
      (c) => c.section === 'crm_owner_weekly_dashboard' && c.action === 'view',
    );
    const hasFinance = hasCeoFinanceView(actor.caps);
    const unresolved = !Number.isFinite(actor.staffId) || actor.staffId <= 0;

    const columnDegraded: Partial<Record<TowerColumnId, string>> = {};
    if (unresolved) {
      for (const id of COLUMN_IDS) columnDegraded[id] = 'unresolved_staff';
    } else {
      if (!hasLeads) {
        columnDegraded.lead_b2 = 'missing_leads_cap';
        columnDegraded.intake = 'missing_leads_cap';
        columnDegraded.consult = 'missing_leads_cap';
      }
      if (!hasContract) columnDegraded.contract = 'missing_contract_cap';
      if (!hasBoard) columnDegraded.tmmt_deliver = 'missing_board_cap';
      if (!hasCskh) columnDegraded.care = 'missing_cskh_cap';
    }

    let raw: TowerCandidate[] = [];
    let candidatesOk = false;
    if (unresolved) {
      degraded.push({ source: 'candidates', reason: 'unresolved_staff' });
    } else {
      try {
        raw = await withTimeout(
          this.repo.loadCandidates(opts.nowMs, {
            staffId: actor.staffId,
            viewAll: hasGdkdViewAllLeads(actor.caps),
          }),
          SOURCE_TIMEOUT_MS,
        );
        candidatesOk = true;
      } catch (e) {
        degraded.push({
          source: 'candidates',
          reason: String((e as Error)?.message ?? 'failed'),
        });
      }
    }

    if (!hasOps) {
      degraded.push({ source: 'ops', reason: 'missing_ops_cap' });
    }
    if (!hasLeads) {
      degraded.push({ source: 'leads', reason: 'missing_leads_cap' });
    }
    if (!hasBoard) {
      degraded.push({ source: 'board', reason: 'missing_board_cap' });
    }
    if (!hasContract) {
      degraded.push({ source: 'contract', reason: 'missing_contract_cap' });
    }
    if (!hasCskh) {
      degraded.push({ source: 'cskh', reason: 'missing_cskh_cap' });
    }

    const collapsed = collapsePostWonA(raw.filter((c) => !isTowerUatSeed(c.leadId, c.tags)));
    const rows: ClassifiedRow[] = [];
    for (const candidate of collapsed) {
      const factory = factoryOf(candidate);
      if (opts.factoryFilter !== 'both' && factory !== opts.factoryFilter) continue;

      const classified = classifyTowerRow(
        {
          factory,
          leadId: candidate.leadId,
          lifecycleId: candidate.lifecycleId,
          b2Done: candidate.b2Done,
          intakeGo: candidate.intakeGo,
          contractPendingOrActive: candidate.contractPendingOrActive,
          won: candidate.won,
          hasLifecycle: candidate.hasLifecycle,
          clientActive: candidate.clientActive,
          retain: candidate.retain,
          spaOnBoard: candidate.spaOnBoard,
          firstCallDone: candidate.firstCallDone,
          ownerId: candidate.ownerId,
          createdAtMs: candidate.createdAtMs,
          b2DoneAtMs: candidate.b2DoneAtMs,
          intakeGoAtMs: candidate.intakeGoAtMs,
          contractSubmittedAtMs: candidate.contractSubmittedAtMs,
          promoteAtMs: candidate.promoteAtMs,
          nowMs: opts.nowMs,
          tmmtGatePass: candidate.tmmtGatePass,
          tmmtGateKnown: candidate.tmmtGateKnown === true,
          qualityScore: candidate.qualityScore,
          launchQaFail: candidate.launchQaFail,
          launchQaKnown: candidate.launchQaKnown === true,
          stageDeliver: candidate.stageDeliver,
          opsOverdue: hasOps ? candidate.opsOverdue : false,
          opsDueToday: hasOps ? candidate.opsDueToday : false,
          cplWorse40: hasOps ? candidate.cplWorse40 : false,
          contractEndInDays: candidate.contractEndInDays,
          kpiRetainRed: candidate.kpiRetainRed,
          kpiRetainKnown: candidate.kpiRetainKnown === true,
          spaFirstCallBreach: candidate.spaFirstCallBreach,
          spaB2Breach: candidate.spaB2Breach,
          spaCloseBreach: candidate.spaCloseBreach,
          hasConsultHandoff: candidate.hasConsultHandoff,
          valueVnd: candidate.valueVnd,
          opsAlertId: hasOps ? candidate.opsAlertId : null,
        },
        { factoryFilter: opts.factoryFilter },
      );
      rows.push({
        candidate,
        factory,
        column_id: classified.column_id,
        severity: classified.severity,
        sensor_ids: classified.sensor_ids,
        suggest_action: classified.suggest_action,
        ageMs: clockAgeMs(candidate, classified.column_id, opts.nowMs),
      });
    }

    const k_strip = await this.loadKStrip(hasKStrip, hasCskh, degraded);
    const financeResult = await this.loadFinanceStrip(actor, hasKStrip, hasFinance, degraded);
    const roster = await this.loadRoster(degraded);
    const sensors_ok = buildSensorsOk(rows, {
      candidatesOk,
      hasOps,
      hasLeads,
      hasBoard,
      hasContract,
      hasCskh,
      hasFinanceMetrics: financeResult.financeMetricsOk,
      s11Fail: financeResult.s11Fail,
    });

    return {
      rows,
      k_strip,
      finance_strip: financeResult.strip,
      roster,
      s11Fail: financeResult.s11Fail,
      financeMetricsOk: financeResult.financeMetricsOk,
      degraded,
      sensors_ok,
      columnDegraded,
    };
  }

  private async loadRoster(degraded: TowerPayload['degraded']): Promise<TowerRosterEntry[]> {
    if (!this.crmStaff) return [];
    try {
      const bundle = await withTimeout(this.crmStaff.listStaff(500), SOURCE_TIMEOUT_MS);
      return bundle.staff.map((row) => ({
        staff_id: row.id,
        name: row.name,
        department_code: row.dept_code || null,
        position_code: row.position_catalog_code || null,
      }));
    } catch (e) {
      degraded.push({
        source: 'capacity',
        reason: String((e as Error)?.message ?? 'failed'),
      });
      return [];
    }
  }

  private async loadKStrip(
    hasCap: boolean,
    hasCskh: boolean,
    degraded: TowerPayload['degraded'],
  ): Promise<TowerPayload['k_strip']> {
    if (!hasCap) {
      degraded.push({ source: 'k_strip', reason: 'missing_cap' });
      return [];
    }
    try {
      const metrics = await withTimeout(this.ownerWeekly.loadLifecycleKpiStrip(), SOURCE_TIMEOUT_MS);
      const strip = metrics.map((m) => ({
        key: m.key,
        value: m.value,
        status: m.status,
        href: '/crm/owner-weekly' as const,
      }));
      if (!hasCskh) {
        degraded.push({ source: 'k4', reason: 'missing_cskh_cap' });
        return strip.filter((m) => m.key !== 'k4');
      }
      return strip;
    } catch (e) {
      degraded.push({
        source: 'k_strip',
        reason: String((e as Error)?.message ?? 'failed'),
      });
      return [];
    }
  }

  private async loadFinanceStrip(
    actor: CeoActor,
    hasOwnerWeeklyCap: boolean,
    hasFinanceCap: boolean,
    degraded: TowerPayload['degraded'],
  ): Promise<{ strip?: TowerFinanceStrip; s11Fail: boolean; financeMetricsOk: boolean }> {
    if (!hasOwnerWeeklyCap || !hasFinanceCap) {
      degraded.push({ source: 'finance', reason: 'missing_cap' });
      return { s11Fail: false, financeMetricsOk: false };
    }
    try {
      const metrics = await withTimeout(this.ownerWeekly.loadFinanceMetrics(), SOURCE_TIMEOUT_MS);
      let revenue30: number | null = null;
      if (this.nlQuery) {
        try {
          const rev30 = await withTimeout(
            this.nlQuery.runQuery({
              intent_id: 'revenue_received_30d',
              actorId: String(actor.staffId),
            }),
            SOURCE_TIMEOUT_MS,
          );
          const raw = (rev30.data?.rows?.[0] as Record<string, unknown> | undefined)?.amount_vnd;
          revenue30 = raw == null ? null : Number(raw);
          if (revenue30 != null && !Number.isFinite(revenue30)) revenue30 = null;
        } catch {
          revenue30 = null;
        }
      }
      const strip = buildFinanceStrip({
        ...metrics,
        revenue_received_30d: revenue30,
      });
      const s11Fail = isS11Fail(metrics.top1_share_pct, metrics.top1_share_max_pct);
      return { strip, s11Fail, financeMetricsOk: true };
    } catch (e) {
      degraded.push({
        source: 'finance',
        reason: String((e as Error)?.message ?? 'failed'),
      });
      return { s11Fail: false, financeMetricsOk: false };
    }
  }
}

function parseFactory(raw?: string): 'A' | 'B' | 'both' {
  const v = String(raw ?? 'both').trim().toUpperCase();
  if (v === 'A' || v === 'B') return v;
  return 'both';
}

function parseColumn(raw?: string): TowerColumnId | null {
  const v = String(raw ?? '').trim();
  return (COLUMN_IDS as string[]).includes(v) ? (v as TowerColumnId) : null;
}

function parseSeverity(raw?: string): Set<TowerSeverity> {
  const tokens = String(raw ?? 'red,amber')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const wanted = new Set<TowerSeverity>();
  for (const t of tokens) {
    if (t === 'red' || t === 'amber' || t === 'ok') wanted.add(t);
  }
  if (!wanted.size) {
    wanted.add('red');
    wanted.add('amber');
  }
  return wanted;
}

function clampLimit(raw?: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 40;
  return Math.min(80, Math.max(1, Math.trunc(n)));
}

function factoryOf(c: TowerCandidate): TowerFactory {
  const kind = resolveLeadFlowKind({
    clientId: c.clientId,
    channel: c.channel,
    source: c.source,
    status: c.status,
    metaJson: (c.metaJson ?? null) as string | Record<string, unknown> | null,
    hasPresales: c.hasPresales,
  });
  return kind === 'spa_operational' ? 'B' : 'A';
}

function collapsePostWonA(rows: TowerCandidate[]): TowerCandidate[] {
  const byLead = new Map<number, TowerCandidate[]>();
  for (const row of rows) {
    const list = byLead.get(row.leadId) ?? [];
    list.push(row);
    byLead.set(row.leadId, list);
  }
  const out: TowerCandidate[] = [];
  for (const group of byLead.values()) {
    const lifecycle = group.find((g) => g.hasLifecycle && g.lifecycleId != null);
    if (lifecycle && factoryOf(lifecycle) === 'A') {
      out.push(lifecycle);
      continue;
    }
    out.push(...group);
  }
  return out;
}

function clockAgeMs(c: TowerCandidate, column: TowerColumnId, nowMs: number): number {
  let start = c.createdAtMs;
  if (column === 'intake') start = c.b2DoneAtMs ?? start;
  if (column === 'consult') start = c.intakeGoAtMs ?? start;
  if (column === 'contract') start = c.contractSubmittedAtMs ?? start;
  if (column === 'tmmt_deliver') start = c.promoteAtMs ?? start;
  return Math.max(0, nowMs - start);
}

function inExceptionWindow(row: ClassifiedRow, nowMs: number): boolean {
  if (row.severity === 'red' || row.severity === 'amber') return true;
  return nowMs - row.candidate.lastActivityMs <= EXCEPTION_WINDOW_MS;
}

function compareExceptions(a: ClassifiedRow, b: ClassifiedRow): number {
  const rank = { red: 0, amber: 1, ok: 2 };
  const sev = rank[a.severity] - rank[b.severity];
  if (sev !== 0) return sev;
  if (b.ageMs !== a.ageMs) return b.ageMs - a.ageMs;
  return (b.candidate.valueVnd ?? -1) - (a.candidate.valueVnd ?? -1);
}

function entityOf(row: ClassifiedRow): { entity_type: 'lead' | 'lifecycle'; entity_id: number } {
  if (row.candidate.hasLifecycle && row.candidate.lifecycleId != null) {
    return { entity_type: 'lifecycle', entity_id: row.candidate.lifecycleId };
  }
  return { entity_type: 'lead', entity_id: row.candidate.leadId };
}

function ageLabel(ageMs: number): string {
  const hours = Math.max(1, Math.floor(ageMs / H));
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)} ngày`;
}

function titleVi(row: ClassifiedRow): string {
  const age = ageLabel(row.ageMs);
  const { entity_type, entity_id } = entityOf(row);
  const prefix = entity_type === 'lifecycle' ? 'Lifecycle' : 'Lead';
  if (row.sensor_ids.includes('S1')) return `Lead #${row.candidate.leadId} chưa owner ${age}`;
  if (row.sensor_ids.includes('S4') || row.column_id === 'contract') {
    return `HĐ #${entity_id} chờ duyệt ${age}`;
  }
  if (row.sensor_ids.includes('S9')) return `Lead #${row.candidate.leadId} vỡ SLA CSKH ${age}`;
  if (row.sensor_ids.includes('S7')) return `${prefix} #${entity_id} ops quá hạn`;
  return `${prefix} #${entity_id} ${COLUMN_LABEL_VI[row.column_id]} ${age}`;
}

function slaSuggestFields(row: ClassifiedRow): Record<string, string> {
  if (row.suggest_action !== 'sla_remind_lead' && !row.sensor_ids.includes('S9')) {
    return {};
  }
  if (row.candidate.spaFirstCallBreach) {
    return { tier: 'first_call_15m', suggested_action: 'log_call' };
  }
  if (row.candidate.spaB2Breach) {
    return { tier: 'b2_complete_4h', suggested_action: 'complete_b2' };
  }
  if (row.candidate.spaCloseBreach) {
    return { tier: 'close_24h', suggested_action: 'set_chot_audit' };
  }
  return { tier: 'first_call_15m', suggested_action: 'log_call' };
}

function toException(row: ClassifiedRow, _nowMs: number): TowerException {
  const { entity_type, entity_id } = entityOf(row);
  const href = towerDrillHref({
    factory: row.factory,
    columnId: row.column_id,
    sensorIds: row.sensor_ids,
    leadId: row.candidate.leadId,
    lifecycleId: row.candidate.lifecycleId ?? undefined,
    clientUuid: row.candidate.clientUuid ?? undefined,
  });
  const suggest_params = row.suggest_action
    ? {
        lead_id: row.candidate.leadId,
        ...(row.candidate.lifecycleId != null ? { lifecycle_id: row.candidate.lifecycleId } : {}),
        ...(row.candidate.opsAlertId != null ? { alert_id: row.candidate.opsAlertId } : {}),
        ...(row.candidate.ownerId != null
          ? { owner_staff_id: row.candidate.ownerId, staff_id: row.candidate.ownerId }
          : {}),
        ...slaSuggestFields(row),
      }
    : null;
  return {
    factory: row.factory,
    column_id: row.column_id,
    sensor_ids: row.sensor_ids,
    severity: row.severity,
    title_vi: titleVi(row),
    entity_type,
    entity_id,
    owner_staff_id: row.candidate.ownerId,
    owner_name: row.candidate.ownerName,
    age_label: ageLabel(row.ageMs),
    value_vnd: row.candidate.valueVnd,
    department_code: row.candidate.departmentCode,
    team_code: row.candidate.teamCode,
    position_code: row.candidate.positionCode,
    job_function: row.candidate.jobFunction,
    href,
    suggest_action: row.suggest_action,
    suggest_params,
  };
}

function applyCursor(rows: TowerException[], cursor?: string): TowerException[] {
  const raw = String(cursor ?? '').trim();
  if (!raw) return rows;
  const sep = raw.indexOf(':');
  if (sep <= 0) return rows;
  const entity_type = raw.slice(0, sep);
  const entity_id = Number(raw.slice(sep + 1));
  const idx = rows.findIndex(
    (r) => r.entity_type === entity_type && r.entity_id === entity_id,
  );
  if (idx < 0) return rows;
  return rows.slice(idx + 1);
}

function buildColumns(
  rows: ClassifiedRow[],
  columnDegraded: Partial<Record<TowerColumnId, string>>,
): TowerPayload['columns'] {
  return COLUMN_IDS.map((column_id) => {
    const reason = columnDegraded[column_id];
    if (reason) {
      return {
        column_id,
        red_count: 0,
        amber_count: 0,
        ok_count: 0,
        header_severity: 'ok' as TowerSeverity,
        degraded: { reason },
      };
    }
    const inCol = rows.filter((r) => r.column_id === column_id);
    const red_count = inCol.filter((r) => r.severity === 'red').length;
    const amber_count = inCol.filter((r) => r.severity === 'amber').length;
    const ok_count = inCol.filter((r) => r.severity === 'ok').length;
    const header_severity: TowerSeverity = red_count > 0 ? 'red' : amber_count > 0 ? 'amber' : 'ok';
    return { column_id, red_count, amber_count, ok_count, header_severity };
  });
}

function buildSensorsOk(
  rows: ClassifiedRow[],
  flags: {
    candidatesOk: boolean;
    hasOps: boolean;
    hasLeads: boolean;
    hasBoard: boolean;
    hasContract: boolean;
    hasCskh: boolean;
    hasFinanceMetrics: boolean;
    s11Fail: boolean;
  },
): TowerPayload['sensors_ok'] {
  const out = {} as TowerPayload['sensors_ok'];
  for (const id of SENSOR_IDS) {
    if (id === 'S11') {
      if (!flags.hasFinanceMetrics) {
        out[id] = 'degraded';
        continue;
      }
      out[id] = flags.s11Fail ? 'fail' : 'ok';
      continue;
    }
    if (!flags.candidatesOk && id !== 'S12') {
      out[id] = 'degraded';
      continue;
    }
    if (id === 'S7' && !flags.hasOps) {
      out[id] = 'degraded';
      continue;
    }
    if ((id === 'S1' || id === 'S2' || id === 'S3') && !flags.hasLeads) {
      out[id] = 'degraded';
      continue;
    }
    if (id === 'S4' && !flags.hasContract) {
      out[id] = 'degraded';
      continue;
    }
    if ((id === 'S5' || id === 'S6' || id === 'S8') && !flags.hasBoard) {
      out[id] = 'degraded';
      continue;
    }
    if (id === 'S5' && !rows.some((r) => r.candidate.tmmtGateKnown === true)) {
      out[id] = 'degraded';
      continue;
    }
    if (id === 'S6' && !rows.some((r) => r.candidate.launchQaKnown === true)) {
      out[id] = 'degraded';
      continue;
    }
    if ((id === 'S9' || id === 'S10') && !flags.hasCskh) {
      out[id] = 'degraded';
      continue;
    }
    out[id] = rows.some((r) => r.sensor_ids.includes(id)) ? 'fail' : 'ok';
  }
  return out;
}
