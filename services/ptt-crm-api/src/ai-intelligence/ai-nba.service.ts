import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CasesSqliteRepository } from '../cases/cases-sqlite.repository';
import { AI_USE_CASE } from './ai-audit.constants';
import { AiAuditService } from './ai-audit.service';
import { AiRecommendationsRepository } from './ai-recommendations.repository';
import { DealScoreContextRepository } from './deal-score-context.repository';
import { computeDealScoreV1 } from './deal-score.engine';
import {
  NextBestActionRequest,
  NextBestActionResponse,
} from './deal-score.types';

const NBA_ACTIONS: Record<string, { label: string; taskTemplate: string }> = {
  call_back: {
    label: 'Gọi lại khách',
    taskTemplate: 'NBA: Gọi lại khách — deal đứng im ≥7 ngày',
  },
  send_proposal: {
    label: 'Gửi báo giá / proposal',
    taskTemplate: 'NBA: Gửi proposal cập nhật cho deal',
  },
  escalate_gdkd: {
    label: 'Escalate GDKD',
    taskTemplate: 'NBA: Escalate GDKD — deal rủi ro cao',
  },
};

@Injectable()
export class AiNbaService {
  constructor(
    private readonly audit: AiAuditService,
    private readonly dealContext: DealScoreContextRepository,
    private readonly recommendations: AiRecommendationsRepository,
    private readonly cases: CasesSqliteRepository,
  ) {}

  async suggestNextBestAction(input: NextBestActionRequest): Promise<NextBestActionResponse> {
    if (!(await this.recommendations.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'ai_recommendations_not_ready',
        message: 'Apply RNOS-01 DDL before NBA',
      });
    }

    const dealId = input.deal_id ?? Number(input.entity_id);
    if (!Number.isFinite(dealId) || dealId <= 0) {
      throw new BadRequestException({ error: 'deal_id_required' });
    }

    const requestId = input.correlationId?.trim() || this.audit.newRequestId();

    if (!input.force) {
      const pending = await this.recommendations.listByEntity('deal', String(dealId), 'pending', 1);
      const existing = pending.find((r) => r.recommendation_type === 'nba');
      if (existing) {
        return this.toResponse(existing, dealId, requestId);
      }
    }

    const ctx = this.dealContext.loadDealScoreContext(dealId);
    if (!ctx) {
      throw new NotFoundException({ error: 'deal_not_found', deal_id: dealId });
    }
    if (ctx.isTerminal) {
      throw new BadRequestException({ error: 'deal_terminal', message: 'NBA not emitted for won/lost deals' });
    }

    const scored = computeDealScoreV1(ctx);
    if (!scored.isStalled && !input.force) {
      throw new BadRequestException({
        error: 'deal_not_stalled',
        message: 'NBA chỉ phát khi deal đứng im ≥7 ngày hoặc trễ SLA',
        stalled_days: scored.stalledDays,
      });
    }

    const action = this.pickAction(ctx.pipelineStage, scored.score);
    const actionMeta = NBA_ACTIONS[action] ?? NBA_ACTIONS.call_back;
    const reason = `Deal "${ctx.title}" đứng im ${scored.stalledDays} ngày ở stage ${ctx.pipelineStage}. Điểm deal ${Math.round(scored.score)}/100.`;

    const wrapped = await this.audit.wrap(
      {
        useCase: AI_USE_CASE.NEXT_BEST_ACTION,
        entityType: 'deal',
        entityId: String(dealId),
        actorId: input.actorId ?? null,
        correlationId: requestId,
        modelName: 'nba-rules-v1',
        input: { deal_id: dealId, action, stalled_days: scored.stalledDays, score: scored.score },
      },
      async () => ({
        data: { action, reason, confidence: scored.confidence },
        output: { action, reason },
        modelName: 'nba-rules-v1',
        tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      }),
    );

    const record = await this.recommendations.insert({
      entityType: 'deal',
      entityId: String(dealId),
      recommendationType: 'nba',
      text: `${actionMeta.label}: ${reason}`,
      actionJson: {
        action,
        action_label: actionMeta.label,
        task_template: actionMeta.taskTemplate,
        reason,
        stalled_days: scored.stalledDays,
        deal_score: scored.score,
      },
      confidence: wrapped.data.confidence,
      agentRunId: wrapped.runId,
    });

    return this.toResponse(record, dealId, requestId, wrapped.runId);
  }

  async executeNbaAccept(recommendationId: string, actorName?: string | null): Promise<number | null> {
    const rec = await this.recommendations.findById(recommendationId);
    if (!rec || rec.recommendation_type !== 'nba' || rec.entity_type !== 'deal') {
      return null;
    }
    const dealId = Number(rec.entity_id);
    if (!Number.isFinite(dealId)) return null;
    const template = String(rec.action_json?.task_template ?? rec.recommendation_text);
    const body = `[NBA accepted${actorName ? ` · ${actorName}` : ''}] ${template}`;
    const event = this.cases.createEvent(dealId, body);
    return event.id;
  }

  private pickAction(stage: string, score: number): string {
    if (score < 35) return 'escalate_gdkd';
    if (stage === 'bao_gia' || stage === 'sql') return 'send_proposal';
    return 'call_back';
  }

  private toResponse(
    record: Awaited<ReturnType<AiRecommendationsRepository['insert']>>,
    dealId: number,
    requestId: string,
    agentRunId?: string,
  ): NextBestActionResponse {
    const action = String(record.action_json?.action ?? 'call_back');
    const actionLabel = String(record.action_json?.action_label ?? NBA_ACTIONS[action]?.label ?? action);
    return {
      data: {
        recommendation_id: record.id,
        deal_id: dealId,
        action,
        action_label: actionLabel,
        reason: String(record.action_json?.reason ?? record.recommendation_text),
        confidence: record.confidence ?? 0.6,
        status: record.status,
        recommendation_text: record.recommendation_text,
        agent_run_id: agentRunId ?? record.agent_run_id ?? '',
      },
      meta: { request_id: requestId },
      errors: [],
    };
  }
}
