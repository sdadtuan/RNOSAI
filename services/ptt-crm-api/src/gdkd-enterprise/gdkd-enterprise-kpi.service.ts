import { Injectable } from '@nestjs/common';
import { AiAdoptionAnalyticsService } from '../ai-intelligence/ai-adoption-analytics.service';
import { AiRecommendationsRepository } from '../ai-intelligence/ai-recommendations.repository';
import { CskhBoardService } from '../cskh-board/cskh-board.service';
import { LeadsFunnelService } from '../leads-funnel/leads-funnel.service';
import {
  buildGdkdEnterpriseKpiResponse,
  resolveGdkdMetricsWindow,
  type GdkdEnterpriseKpiResponse,
} from './gdkd-enterprise-kpi.util';

const CLOSED_LOOP_WINDOW_DAYS = 30;

@Injectable()
export class GdkdEnterpriseKpiService {
  constructor(
    private readonly cskhBoard: CskhBoardService,
    private readonly funnel: LeadsFunnelService,
    private readonly adoption: AiAdoptionAnalyticsService,
    private readonly recommendations: AiRecommendationsRepository,
  ) {}

  async getEnterpriseKpi(query: { days?: number } = {}): Promise<GdkdEnterpriseKpiResponse> {
    const { from, to, days } = resolveGdkdMetricsWindow(query.days);

    const [slaTiers, reviewQueue, adoptionMetrics, nbaMetrics, closedLoop] = await Promise.all([
      this.cskhBoard.getSlaDashboardTiers(),
      this.funnel.listReviewQueue(500),
      this.adoption.getAdoptionMetrics({ days }),
      this.recommendations.getAcceptanceMetrics({
        from,
        to,
        recommendationType: 'nba',
      }),
      this.cskhBoard.getClosedLoopDashboard(CLOSED_LOOP_WINDOW_DAYS, 5),
    ]);

    const hoursWaiting = reviewQueue.leads
      .map((row) => row.review_queue.hours_waiting)
      .filter((hours): hours is number => hours != null && Number.isFinite(hours));

    const breachBacklog =
      slaTiers.first_call_15m.breach +
      slaTiers.b2_complete_4h.breach +
      slaTiers.close_24h.breach;

    return buildGdkdEnterpriseKpiResponse({
      generatedAt: new Date().toISOString(),
      windowDays: days,
      closedLoopWindowDays: CLOSED_LOOP_WINDOW_DAYS,
      slaTiers,
      breachBacklog,
      reviewQueueCount: reviewQueue.leads.length,
      reviewQueueMaxHours: hoursWaiting.length ? Math.max(...hoursWaiting) : null,
      copilotDauRatePct: adoptionMetrics.data.copilot_dau_rate_pct,
      copilotDauLatest: adoptionMetrics.data.copilot_dau_latest,
      pilotDenominator: adoptionMetrics.data.pilot_denominator,
      nbaAcceptancePct: nbaMetrics.acceptance_rate_pct,
      nbaResolved: nbaMetrics.total_resolved,
      dealValueFillPct: closedLoop.summary.deal_value_fill_pct,
      chotTotal: closedLoop.summary.chot_total,
    });
  }
}
