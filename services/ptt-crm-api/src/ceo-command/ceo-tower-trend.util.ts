import { resolveLeadFlowKind } from '../leads-funnel/lead-flow-kind.util';
import { classifyTowerRow } from './ceo-tower-sensors.util';
import type { TowerCandidate, TowerColumnId, TowerSeverity } from './ceo-tower.types';

const H = 3600_000;
const D = 24 * H;
const ICT_OFFSET_MS = 7 * H;
const TREND_DAYS = 7;

export type TowerTrendSeries = {
  labels: string[];
  total_issues: number[];
  red_issues: number[];
  by_column: Record<TowerColumnId, number[]>;
};

export type TowerTrendWow = {
  current_total: number;
  prev_week_total: number;
  delta: number;
  direction: 'up' | 'down' | 'flat';
};

export type TowerTrendPayload = {
  series: TowerTrendSeries;
  wow: TowerTrendWow;
};

export type BuildTowerTrendOpts = {
  factoryFilter: 'A' | 'B' | 'both';
  nowMs: number;
  hasOps: boolean;
  columnDegraded: Partial<Record<TowerColumnId, string>>;
};

function factoryOf(c: TowerCandidate): 'A' | 'B' {
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

function ictDayStartUtc(nowMs: number): number {
  const ictMs = nowMs + ICT_OFFSET_MS;
  const dayIndex = Math.floor(ictMs / D);
  return dayIndex * D - ICT_OFFSET_MS;
}

function ictDayLabel(dayStartMs: number): string {
  const ict = new Date(dayStartMs + ICT_OFFSET_MS);
  const weekdays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  return weekdays[ict.getUTCDay()] ?? '—';
}

function countIssuesAt(
  candidates: TowerCandidate[],
  virtualNowMs: number,
  opts: BuildTowerTrendOpts,
): { total: number; red: number; byColumn: Record<TowerColumnId, number> } {
  const byColumn: Record<TowerColumnId, number> = {
    lead_b2: 0,
    intake: 0,
    consult: 0,
    contract: 0,
    tmmt_deliver: 0,
    care: 0,
  };
  let total = 0;
  let red = 0;

  for (const candidate of candidates) {
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
        nowMs: virtualNowMs,
        tmmtGatePass: candidate.tmmtGatePass,
        tmmtGateKnown: candidate.tmmtGateKnown === true,
        qualityScore: candidate.qualityScore,
        launchQaFail: candidate.launchQaFail,
        launchQaKnown: candidate.launchQaKnown === true,
        stageDeliver: candidate.stageDeliver,
        opsOverdue: opts.hasOps ? candidate.opsOverdue : false,
        opsDueToday: opts.hasOps ? candidate.opsDueToday : false,
        cplWorse40: opts.hasOps ? candidate.cplWorse40 : false,
        contractEndInDays: candidate.contractEndInDays,
        kpiRetainRed: candidate.kpiRetainRed,
        kpiRetainKnown: candidate.kpiRetainKnown === true,
        spaFirstCallBreach: candidate.spaFirstCallBreach,
        spaB2Breach: candidate.spaB2Breach,
        spaCloseBreach: candidate.spaCloseBreach,
        hasConsultHandoff: candidate.hasConsultHandoff,
        valueVnd: candidate.valueVnd,
        opsAlertId: opts.hasOps ? candidate.opsAlertId : null,
      },
      { factoryFilter: opts.factoryFilter },
    );

    if (opts.columnDegraded[classified.column_id]) continue;
    if (classified.severity !== 'red' && classified.severity !== 'amber') continue;
    if (!inExceptionWindow(classified.severity, candidate.lastActivityMs, virtualNowMs)) continue;

    total += 1;
    if (classified.severity === 'red') red += 1;
    byColumn[classified.column_id] += 1;
  }

  return { total, red, byColumn };
}

function inExceptionWindow(
  severity: TowerSeverity,
  lastActivityMs: number,
  nowMs: number,
): boolean {
  if (severity === 'red' || severity === 'amber') return true;
  return nowMs - lastActivityMs <= TREND_DAYS * D;
}

/** 7-day open-issue trend + WoW vs 7 days ago (re-classify at each day-end ICT). */
export function buildTowerTrends(
  candidates: TowerCandidate[],
  opts: BuildTowerTrendOpts,
): TowerTrendPayload {
  const todayStart = ictDayStartUtc(opts.nowMs);
  const labels: string[] = [];
  const totalIssues: number[] = [];
  const redIssues: number[] = [];
  const byColumn: Record<TowerColumnId, number[]> = {
    lead_b2: [],
    intake: [],
    consult: [],
    contract: [],
    tmmt_deliver: [],
    care: [],
  };

  for (let offset = TREND_DAYS - 1; offset >= 0; offset -= 1) {
    const dayStart = todayStart - offset * D;
    const virtualNow = dayStart + D - 1;
    labels.push(ictDayLabel(dayStart));
    const counts = countIssuesAt(candidates, virtualNow, opts);
    totalIssues.push(counts.total);
    redIssues.push(counts.red);
    for (const col of Object.keys(byColumn) as TowerColumnId[]) {
      byColumn[col].push(counts.byColumn[col]);
    }
  }

  const currentTotal = totalIssues[totalIssues.length - 1] ?? 0;
  const prevWeekTotal = totalIssues[0] ?? 0;
  const delta = currentTotal - prevWeekTotal;

  return {
    series: {
      labels,
      total_issues: totalIssues,
      red_issues: redIssues,
      by_column: byColumn,
    },
    wow: {
      current_total: currentTotal,
      prev_week_total: prevWeekTotal,
      delta,
      direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
    },
  };
}
