import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AI_USE_CASE } from './ai-audit.constants';
import { AiAuditService } from './ai-audit.service';
import { AiRecommendationsRepository } from './ai-recommendations.repository';
import { DealScoreContextRepository } from './deal-score-context.repository';
import { computeDealScoreV1 } from './deal-score.engine';
import {
  PipelineRiskListResponse,
  PipelineRiskListResult,
  PipelineRiskScanRequest,
  PipelineRiskScanResponse,
  PipelineRiskScanResult,
} from './pipeline-risk.types';

const PIPELINE_RISK_TYPE = 'pipeline_risk';

@Injectable()
export class PipelineRiskService {
  constructor(
    private readonly audit: AiAuditService,
    private readonly dealContext: DealScoreContextRepository,
    private readonly recommendations: AiRecommendationsRepository,
  ) {}

  async scanDaily(input: PipelineRiskScanRequest = {}): Promise<PipelineRiskScanResponse> {
    if (!(await this.recommendations.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'ai_recommendations_not_ready',
        message: 'Apply RNOS-01 DDL before pipeline risk scan',
      });
    }

    const requestId = input.correlationId?.trim() || this.audit.newRequestId();
    const dealLimit = Math.min(Math.max(input.limit ?? 200, 1), 500);
    const dealIds = this.dealContext.listOpenDealIds(dealLimit);

    let atRiskFound = 0;
    let alertsCreated = 0;
    let alertsSkipped = 0;
    let alertsCleared = 0;

    const wrapped = await this.audit.wrap(
      {
        useCase: AI_USE_CASE.PIPELINE_RISK_SCAN,
        entityType: 'pipeline',
        entityId: 'daily',
        actorId: input.actorId ?? 'system',
        correlationId: requestId,
        modelName: 'pipeline-risk-v1',
        input: { deal_limit: dealLimit, deal_count: dealIds.length },
      },
      async () => {
        for (const dealId of dealIds) {
          const ctx = this.dealContext.loadDealScoreContext(dealId);
          if (!ctx || ctx.isTerminal) {
            continue;
          }

          const scored = computeDealScoreV1(ctx);
          const entityId = String(dealId);

          if (!scored.isStalled) {
            const cleared = await this.recommendations.dismissPendingByTypeForEntity(
              'deal',
              entityId,
              PIPELINE_RISK_TYPE,
              'risk_cleared',
            );
            alertsCleared += cleared;
            continue;
          }

          atRiskFound += 1;
          const existing = await this.recommendations.findRecentPendingByType(
            'deal',
            entityId,
            PIPELINE_RISK_TYPE,
            24,
          );
          if (existing) {
            alertsSkipped += 1;
            continue;
          }

          const reason = `Deal "${ctx.title}" at-risk: đứng im ${scored.stalledDays} ngày ở ${ctx.pipelineStage}.`;
          await this.recommendations.insert({
            entityType: 'deal',
            entityId,
            recommendationType: PIPELINE_RISK_TYPE,
            text: reason,
            actionJson: {
              deal_id: dealId,
              title: ctx.title,
              pipeline_stage: ctx.pipelineStage,
              stalled_days: scored.stalledDays,
              deal_score: scored.score,
              score_band: scored.explainability.score_band,
              risk_flags: scored.explainability.flags ?? [],
            },
            confidence: scored.confidence,
            agentRunId: null,
          });
          alertsCreated += 1;
        }

        const result: PipelineRiskScanResult = {
          scanned: dealIds.length,
          at_risk_found: atRiskFound,
          alerts_created: alertsCreated,
          alerts_skipped: alertsSkipped,
          alerts_cleared: alertsCleared,
          agent_run_id: '',
          scanned_at: new Date().toISOString(),
        };

        return {
          data: result,
          output: { ...result },
          modelName: 'pipeline-risk-v1',
          tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        };
      },
    );

    const data: PipelineRiskScanResult = {
      ...wrapped.data,
      agent_run_id: wrapped.runId,
    };

    return {
      data,
      meta: { request_id: requestId },
      errors: [],
    };
  }

  async listAtRiskDeals(limit = 50, offset = 0): Promise<PipelineRiskListResponse> {
    if (!(await this.recommendations.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'ai_recommendations_not_ready',
        message: 'Apply RNOS-01 DDL before listing pipeline risk',
      });
    }

    const requestId = this.audit.newRequestId();
    const { rows, total } = await this.recommendations.listPendingByType(
      PIPELINE_RISK_TYPE,
      limit,
      offset,
    );
    const lastScanAt = await this.recommendations.latestScanTimestamp(PIPELINE_RISK_TYPE);

    const deals = rows
      .filter((row) => row.entity_type === 'deal')
      .map((row) => {
        const action = row.action_json ?? {};
        const dealId = Number(row.entity_id);
        const ctx = Number.isFinite(dealId) ? this.dealContext.loadDealScoreContext(dealId) : null;
        return {
          deal_id: dealId,
          title: String(action.title ?? ctx?.title ?? `Deal #${row.entity_id}`),
          pipeline_stage: String(action.pipeline_stage ?? ctx?.pipelineStage ?? ''),
          stalled_days: Number(action.stalled_days ?? 0),
          deal_score: Number(action.deal_score ?? 0),
          score_band: String(action.score_band ?? 'warm'),
          recommendation_id: row.id,
          staff_name: null,
          customer_name: null,
          scanned_at: row.created_at,
          status: row.status,
        };
      });

    const data: PipelineRiskListResult = {
      deals,
      total,
      last_scan_at: lastScanAt,
    };

    return {
      data,
      meta: { request_id: requestId },
      errors: [],
    };
  }
}
