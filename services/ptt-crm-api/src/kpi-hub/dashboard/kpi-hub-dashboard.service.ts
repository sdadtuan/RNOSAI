import { BadRequestException, Injectable } from '@nestjs/common';
import { KpiHubAlertsService } from '../alerts/kpi-hub-alerts.service';
import {
  buildCommandFunnel,
  buildCommandTiles,
  formatKpiValue,
  type CommandCenterResponse,
} from '../command-center/command-center.builder';
import { buildApprovalQueue, buildDataTrust } from '../command-center/command-center.trust';
import { isCommandPersona, ruleBasedInsight, type CommandPersona } from '../command-center/command-center.util';
import { KpiHubDictionaryService } from '../dictionary/kpi-hub-dictionary.service';
import { buildDashboardFixture } from '../kpi-hub.fixtures';
import { deriveHubStatus } from '../kpi-hub-status';
import { kpiHubMemory, shouldUseMemory, withDbFallback } from '../kpi-hub.memory-store';
import { KPI_HUB_ERROR_CODES, type HubDashboardQuery } from '../kpi-hub.types';
import { COMMAND_FACT_CODES, KpiHubFactsService } from '../facts/kpi-hub-facts.service';
import { KpiHubQualityService } from '../quality/kpi-hub-quality.service';
import { KpiHubReportsService } from '../reports/kpi-hub-reports.service';
import { KpiHubTargetsService } from '../targets/kpi-hub-targets.service';

@Injectable()
export class KpiHubDashboardService {
  constructor(
    private readonly facts: KpiHubFactsService,
    private readonly targets: KpiHubTargetsService,
    private readonly quality: KpiHubQualityService,
    private readonly alerts: KpiHubAlertsService,
    private readonly dictionary: KpiHubDictionaryService,
    private readonly reports: KpiHubReportsService,
  ) {}

  async getDashboard(query: HubDashboardQuery) {
    if (query.persona) {
      if (!isCommandPersona(query.persona)) {
        throw new BadRequestException({ error: KPI_HUB_ERROR_CODES.CODE_INVALID });
      }
      return this.getCommandCenter(query.persona, query);
    }

    const base = buildDashboardFixture();
    const periodFrom = query.from ?? base.period.from;
    const period = periodFrom.slice(0, 7);

    return withDbFallback(
      async () => {
        const factMap = await this.facts.getFactsMap(period, [...COMMAND_FACT_CODES]);
        if (factMap.size === 0 && !shouldUseMemory()) return null;

        const cards = await Promise.all(
          (['SAL_008', 'MKT_002', 'MKT_006', 'MKT_008', 'SAL_007'] as const).map(async (code) => {
            const fixtureCard = base.cards.find((c) => c.code === code)!;
            const value = factMap.get(code) ?? fixtureCard.value;
            const targetRows = await this.targets.list({ period });
            const targetRow = targetRows.items.find((t) => t.dictionary_code === code);
            const target = targetRow?.target_value ?? fixtureCard.target;
            const status = targetRow?.status ?? deriveHubStatus({
              direction: targetRow?.direction ?? 'HIGHER_IS_BETTER',
              actual: value,
              target,
              warning: targetRow?.warning_value ?? null,
              critical: targetRow?.critical_value ?? null,
            });
            return {
              ...fixtureCard,
              value,
              target,
              status,
            };
          }),
        );

        const funnelCodes = ['MKT_001', 'MKT_002', 'MKT_007', 'SAL_001', 'SAL_003', 'SAL_WON'] as const;
        const funnelStages = funnelCodes.map((code, idx) => {
          const fixtureStage = base.funnel.stages[idx];
          const value = factMap.get(code) ?? fixtureStage.value;
          const prev = idx > 0 ? (factMap.get(funnelCodes[idx - 1]) ?? base.funnel.stages[idx - 1].value) : null;
          const conversion_from_prev =
            prev != null && prev > 0 && value != null ? Math.round((value / prev) * 1000) / 1000 : null;
          return {
            ...fixtureStage,
            code,
            value,
            conversion_from_prev,
          };
        });

        return {
          ...base,
          period: {
            from: periodFrom,
            to: query.to ?? base.period.to,
            timezone: base.period.timezone,
            compare: query.compare === 'true' || query.compare === '1',
          },
          filters: {
            department_id: query.department_id ?? null,
            channel: query.channel ?? null,
            product: query.product ?? null,
            team_id: query.team_id ?? null,
          },
          cards,
          funnel: {
            stages: funnelStages,
            bottleneck: base.funnel.bottleneck,
          },
        } as ReturnType<typeof buildDashboardFixture>;
      },
      () => ({
        ...base,
        period: {
          from: query.from ?? base.period.from,
          to: query.to ?? base.period.to,
          timezone: base.period.timezone,
          compare: query.compare === 'true' || query.compare === '1',
        },
        filters: {
          department_id: query.department_id ?? null,
          channel: query.channel ?? null,
          product: query.product ?? null,
          team_id: query.team_id ?? null,
        },
      }),
    );
  }

  private async getCommandCenter(
    persona: CommandPersona,
    query: HubDashboardQuery,
  ): Promise<CommandCenterResponse> {
    const base = buildDashboardFixture();
    const periodFrom = query.from ?? base.period.from;
    const periodTo = query.to ?? base.period.to;
    const period = periodFrom.slice(0, 7);
    const compare = query.compare === 'true' || query.compare === '1';

    const factCodes = [...COMMAND_FACT_CODES];
    const factMap = await this.facts.getFactsMap(period, factCodes);

    let prevFacts = new Map<string, number | null>();
    if (compare) {
      const [year, month] = period.split('-').map(Number);
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const prevPeriod = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
      prevFacts = await this.facts.getFactsMap(prevPeriod, factCodes);
    }

    const targetRows = await this.targets.list({ period });
    const targets = new Map<
      string,
      { target: number | null; warning: number | null; critical: number | null; direction: string; name: string }
    >();
    for (const row of targetRows.items) {
      targets.set(row.dictionary_code, {
        target: row.target_value,
        warning: row.warning_value,
        critical: row.critical_value,
        direction: row.direction,
        name: row.dictionary_name,
      });
    }

    const qualityOverview = await this.quality.getOverview();
    const dqCritical = (qualityOverview?.critical_count ?? 0) > 0;
    const freshnessByCode = new Map<string, string>();
    for (const src of qualityOverview?.freshness ?? []) {
      freshnessByCode.set(src.system, src.status);
    }

    const tiles = buildCommandTiles({
      persona,
      facts: factMap,
      prevFacts,
      targets,
      freshnessByCode,
      dqCritical,
      sparklines: new Map(),
      format: formatKpiValue,
    });

    const funnel = buildCommandFunnel(persona, factMap);

    const trust = buildDataTrust(
      {
        score: qualityOverview?.score ?? null,
        freshness: (qualityOverview?.freshness ?? []).map((f) => ({
          system: f.system,
          status: f.status,
          last_success_at: f.last_success_at,
        })),
      },
      { includeGa4: persona === 'marketing' },
    );

    const dictList = await this.dictionary.list({ page_size: 100 });
    const reportList = await this.reports.list({});
    const approvals = buildApprovalQueue({
      dictionary: dictList.items.map((d) => ({
        id: d.id,
        code: d.code,
        name: d.name,
        status: d.status,
        tech_preview: null,
      })),
      targets: targetRows.items.map((t) => ({
        id: t.id,
        status: t.status === 'NO_STATUS' ? 'DRAFT' : t.status,
        dictionary_code: t.dictionary_code,
      })),
      reports: (reportList.items ?? []).map((r) => ({
        id: r.id,
        status: r.status,
        name: r.name,
      })),
    });

    const alertList = await this.alerts.list({ status: 'OPEN', page_size: 20 });
    const at_risk = (alertList.items ?? []).map((a) => ({
      id: a.id,
      severity: a.level,
      kpi_code: a.dictionary_code ?? '',
      name: a.title,
      scope: a.scope,
      actual: a.actual,
      target: a.threshold,
      owner: null,
      sla_hours: null,
    }));

    const exceptions = kpiHubMemory.qualityIssues
      .filter((i) => i.status !== 'RESOLVED')
      .map((i) => ({
        id: i.id,
        priority: i.severity,
        object: i.rule_name,
        issue: i.title,
        impact: i.description,
        owner: i.assignee?.name ?? null,
        sla: i.sla_due,
        status: i.status,
      }));

    const primaryCode = tiles[0]?.code ?? 'SAL_008';
    const primaryActual = factMap.get(primaryCode) ?? tiles[0]?.actual ?? null;
    const primaryTarget = targets.get(primaryCode)?.target ?? tiles[0]?.target ?? null;

    const response: CommandCenterResponse = {
      persona,
      period: {
        from: periodFrom,
        to: periodTo,
        timezone: 'Asia/Ho_Chi_Minh',
        compare,
      },
      tiles,
      series: {
        actual: [{ date: periodFrom, value: primaryActual }],
        target: primaryTarget != null ? [{ date: periodFrom, value: primaryTarget }] : [],
        forecast: null,
      },
      at_risk,
      funnel,
      trust,
      approvals,
      exceptions,
    };

    if (persona === 'marketing') {
      response.marketing = {
        spend_series: [],
        channels: [],
        campaigns: [],
        creatives: [],
        insight: ruleBasedInsight({
          spendDeltaPct: tiles.find((t) => t.code === 'MKT_004')?.delta_pct ?? null,
          validDeltaPct: tiles.find((t) => t.code === 'MKT_002')?.delta_pct ?? null,
        }),
        grain: { adset: false, creative: false, landing: false },
      };
    }

    if (persona === 'sales') {
      const probability = factMap.get('SAL_005_P');
      response.sales = {
        pipeline_stacks: [],
        sla: {
          actual_minutes: null,
          target_minutes: 30,
          buckets: {},
          overdue_count: 0,
        },
        team_rows: [],
        deals_at_risk: [],
        weighted_badge: probability != null ? 'weighted' : 'unweighted',
      };
    }

    return response;
  }

  async getDrilldown(code: string, query: HubDashboardQuery) {
    const base = buildDashboardFixture();
    const periodFrom = query.from ?? base.period.from;
    const period = periodFrom.slice(0, 7);
    const factMap = await this.facts.getFactsMap(period, [code]);
    const card = base.cards.find((c) => c.code === code);
    const stage = base.funnel.stages.find((s) => s.code === code);
    const value = factMap.get(code) ?? card?.value ?? stage?.value ?? null;
    return {
      code,
      name: card?.name ?? stage?.name ?? code,
      value,
      formatted: card?.formatted ?? String(value ?? '—'),
      status: card?.status ?? 'NO_DATA',
      breakdown: [
        { label: 'Organic', value: 42, pct: 0.42 },
        { label: 'Paid Social', value: 38, pct: 0.38 },
        { label: 'Referral', value: 20, pct: 0.2 },
      ],
    };
  }
}
