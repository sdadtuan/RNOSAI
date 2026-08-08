import { Injectable, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { ServiceLifecycleService } from '../service-lifecycle/service-lifecycle.service';
import { MarketingAiDashboardService } from './marketing-ai-dashboard.service';
import { MarketingAiPlannerRepository } from './marketing-ai-planner.repository';
import { buildKpiClosedLoopPayload } from './marketing-ai-kpi-closed-loop.util';
import type { MktAiKpiClosedLoopPayload } from './marketing-ai-planner.types';

@Injectable()
export class MarketingAiKpiClosedLoopService {
  constructor(
    private readonly config: AppConfigService,
    private readonly lifecycle: ServiceLifecycleService,
    private readonly dashboard: MarketingAiDashboardService,
    private readonly repo: MarketingAiPlannerRepository,
  ) {}

  isEnabled(): boolean {
    return this.config.mktAiPlannerEnabled && this.config.mktAiKpiClosedLoopEnabled;
  }

  status() {
    return {
      ok: true,
      enabled: this.isEnabled(),
      planner_enabled: this.config.mktAiPlannerEnabled,
      closed_loop_enabled: this.config.mktAiKpiClosedLoopEnabled,
      alert_threshold_pct: this.config.mktAiKpiAlertCplPct,
      weekly_memo_cron: this.config.mktAiWeeklyMemoCron,
    };
  }

  private assertEnabled(serviceSlug?: string): void {
    if (!this.config.mktAiPlannerEnabled) {
      throw new NotFoundException({ error: 'mkt_ai_planner_disabled' });
    }
    const slugs = this.config.mktAiPlannerSlugs;
    if (slugs.length && serviceSlug && !slugs.includes(serviceSlug)) {
      throw new NotFoundException({ error: 'mkt_ai_planner_slug_not_pilot', service_slug: serviceSlug });
    }
    if (!this.isEnabled()) {
      throw new NotFoundException({ error: 'mkt_ai_kpi_closed_loop_disabled' });
    }
  }

  async getClosedLoop(
    lifecycleId: number,
    opts: { weeks?: number; channel?: string } = {},
  ): Promise<MktAiKpiClosedLoopPayload> {
    const lc = await this.lifecycle.detail(lifecycleId);
    const serviceSlug = String((lc as Record<string, unknown>).service_slug ?? '');
    this.assertEnabled(serviceSlug);

    const draft = await this.repo.ensureDraft(lifecycleId, 'kpi-closed-loop');
    const dashboard = await this.dashboard.getDashboard(lifecycleId, {
      weeks: opts.weeks ?? 6,
      channel: opts.channel ?? 'meta',
    });

    return buildKpiClosedLoopPayload({
      enabled: true,
      lifecycleId,
      appliedTree: draft.kpi_tree_applied_json,
      dashboard,
      thresholdPct: this.config.mktAiKpiAlertCplPct,
    });
  }
}
