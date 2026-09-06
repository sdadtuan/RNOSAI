import { Injectable } from '@nestjs/common';
import { KpiHubDashboardService } from '../kpi-hub/dashboard/kpi-hub-dashboard.service';
import type { CommandCenterResponse, CommandTile } from '../kpi-hub/command-center/command-center.builder';
import { RevopsActionsService } from './revops-actions.service';
import { RevopsCommissionService } from './revops-commission.service';
import { resolveRevopsBuFilter, resolveRevopsScope } from './revops-scope.util';
import { RevopsTeamPerformanceService } from './revops-team-performance.service';
import type {
  RevopsCommandCenterDto,
  RevopsDashboardActor,
  RevopsDashboardQuery,
} from './revops.types';

const EMPTY_COMMISSION: RevopsCommandCenterDto['commission'] = {
  estimatedVnd: null,
  approvedVnd: null,
  pendingVnd: null,
};

function currentPeriod(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).format(now);
}

export function normalizeRevopsPeriod(raw?: string): { period: string; from: string } {
  const fallback = currentPeriod();
  const value = raw?.trim() ?? '';
  if (/^\d{4}-\d{2}$/.test(value)) return { period: value, from: `${value}-01` };
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return { period: value.slice(0, 7), from: value };
  return { period: fallback, from: `${fallback}-01` };
}

function tileOf(cc: CommandCenterResponse | null, code: string): CommandTile | undefined {
  return cc?.tiles.find((t) => t.code === code);
}

function ratioPct(actual: number | null, target: number | null): number | null {
  if (actual == null || target == null || target === 0) return null;
  return Math.round((actual / target) * 100);
}

function coverageX(weighted: number | null, target: number | null): number | null {
  if (weighted == null || target == null || target === 0) return null;
  return Math.round((weighted / target) * 10) / 10;
}

function emptyCenter(
  period: string,
  bu: string,
  extras: Pick<RevopsCommandCenterDto, 'todayQueue' | 'atRisk' | 'fetchedAt'>,
): RevopsCommandCenterDto {
  return {
    period,
    bu,
    revenue: { actualVnd: null, targetVnd: null, attainmentPct: null, deltaPct: null },
    pipeline: { weightedVnd: null, coverageX: null, activeDeals: 0, commitDeals: 0 },
    leadSla: { compliancePct: null, atRisk: 0, breaches: 0 },
    commission: { ...EMPTY_COMMISSION },
    funnel: [],
    teamRevenue: [],
    teamPerformance: [],
    ...extras,
  };
}

@Injectable()
export class RevopsDashboardService {
  constructor(
    private readonly kpiHub: KpiHubDashboardService,
    private readonly actions: RevopsActionsService,
    private readonly teamPerf: RevopsTeamPerformanceService,
    private readonly commissionSvc: RevopsCommissionService,
  ) {}

  async get(actor: RevopsDashboardActor, query: RevopsDashboardQuery): Promise<RevopsCommandCenterDto> {
    const { period, from } = normalizeRevopsPeriod(query.period);
    const scope = resolveRevopsScope({ requested: query.scope, caps: actor.caps });
    const buFilter = resolveRevopsBuFilter({ scope, requestedBu: query.bu });
    const bu = buFilter ?? (scope === 'me' ? 'me' : query.bu?.trim() || 'all');

    const [todayQueue, atRisk, commission] = await Promise.all([
      this.actions.todayQueue(),
      this.actions.atRisk(),
      this.commissionSvc.getSummary(),
    ]);
    const extras = { todayQueue, atRisk, fetchedAt: new Date().toISOString() };

    let hub: CommandCenterResponse | null = null;
    try {
      hub = (await this.kpiHub.getDashboard({
        persona: 'sales',
        from,
        department_id: buFilter,
      })) as CommandCenterResponse;
    } catch {
      return { ...emptyCenter(period, bu, extras), commission };
    }

    const revenueTile = tileOf(hub, 'SAL_008');
    const weightedTile = tileOf(hub, 'SAL_005W');
    const pipelineOpen = tileOf(hub, 'SAL_005');
    const actualVnd = revenueTile?.actual ?? null;
    const targetVnd = revenueTile?.target ?? null;
    const weightedVnd = weightedTile?.actual ?? null;
    const funnel = (hub.funnel?.stages ?? []).map((s) => ({
      stage: s.name,
      count: s.value ?? 0,
    }));
    const activeDeals = funnel.reduce((sum, s) => sum + (s.count || 0), 0);
    const teamPerformance = this.teamPerf.fromKpiRows(
      (hub.sales?.team_rows ?? []) as Array<Record<string, unknown>>,
    );

    return {
      period,
      bu,
      revenue: {
        actualVnd,
        targetVnd,
        attainmentPct: ratioPct(actualVnd, targetVnd),
        deltaPct: revenueTile?.delta_pct ?? null,
      },
      pipeline: {
        weightedVnd,
        coverageX: coverageX(weightedVnd, targetVnd ?? pipelineOpen?.target ?? null),
        activeDeals,
        commitDeals: 0,
      },
      leadSla: {
        compliancePct: null,
        atRisk: hub.sales?.sla.overdue_count ?? 0,
        breaches: 0,
      },
      commission,
      funnel,
      teamRevenue: this.teamPerf.teamRevenueFromRows(teamPerformance),
      teamPerformance,
      ...extras,
    };
  }
}
