import { Injectable } from '@nestjs/common';
import { buildDashboardFixture } from '../kpi-hub.fixtures';
import { deriveHubStatus } from '../kpi-hub-status';
import { shouldUseMemory, withDbFallback } from '../kpi-hub.memory-store';
import type { HubDashboardQuery } from '../kpi-hub.types';
import { DASHBOARD_CODES, FUNNEL_CODES, KpiHubFactsService } from '../facts/kpi-hub-facts.service';
import { KpiHubTargetsService } from '../targets/kpi-hub-targets.service';

@Injectable()
export class KpiHubDashboardService {
  constructor(
    private readonly facts: KpiHubFactsService,
    private readonly targets: KpiHubTargetsService,
  ) {}

  async getDashboard(query: HubDashboardQuery) {
    const base = buildDashboardFixture();
    const periodFrom = query.from ?? base.period.from;
    const period = periodFrom.slice(0, 7);

    return withDbFallback(
      async () => {
        const factMap = await this.facts.getFactsMap(period, [...DASHBOARD_CODES, ...FUNNEL_CODES]);
        if (factMap.size === 0 && !shouldUseMemory()) return null;

        const cards = await Promise.all(
          DASHBOARD_CODES.map(async (code) => {
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

        const funnelStages = FUNNEL_CODES.map((code, idx) => {
          const fixtureStage = base.funnel.stages[idx];
          const value = factMap.get(code) ?? fixtureStage.value;
          const prev = idx > 0 ? (factMap.get(FUNNEL_CODES[idx - 1]) ?? base.funnel.stages[idx - 1].value) : null;
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
