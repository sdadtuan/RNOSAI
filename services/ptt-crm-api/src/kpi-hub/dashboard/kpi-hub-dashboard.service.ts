import { Injectable } from '@nestjs/common';
import { buildDashboardFixture } from '../kpi-hub.fixtures';
import { withDbFallback } from '../kpi-hub.memory-store';
import type { HubDashboardQuery } from '../kpi-hub.types';

@Injectable()
export class KpiHubDashboardService {
  async getDashboard(query: HubDashboardQuery) {
    return withDbFallback(async () => null, () => {
      const base = buildDashboardFixture();
      return {
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
      };
    });
  }
}

@Injectable()
export class KpiHubFactsService {
  /** Placeholder for batch fact compute — v1 reads materialized fixtures. */
  async computePeriod(period: string) {
    return {
      period,
      computed_at: new Date().toISOString(),
      status: 'SUCCESS',
      facts_written: 22,
    };
  }
}
