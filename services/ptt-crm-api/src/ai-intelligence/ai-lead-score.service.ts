import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DomainEventService } from '../events/domain-event.service';
import { AI_USE_CASE } from './ai-audit.constants';
import { AiAuditService } from './ai-audit.service';
import { AiScoreRecord } from './lead-score.types';
import { AiScoresRepository } from './ai-scores.repository';
import { computeLeadScoreV1 } from './lead-score.engine';
import { LeadScoreContextRepository } from './lead-score-context.repository';
import {
  AiScoresListResponse,
  LEAD_SCORE_MODEL,
  LEAD_SCORE_MODEL_VERSION,
  ScoreLeadRequest,
  ScoreLeadResponse,
} from './lead-score.types';

@Injectable()
export class AiLeadScoreService {
  constructor(
    private readonly scores: AiScoresRepository,
    private readonly contextRepo: LeadScoreContextRepository,
    private readonly audit: AiAuditService,
    private readonly events: DomainEventService,
  ) {}

  async scoreLead(input: ScoreLeadRequest): Promise<ScoreLeadResponse> {
    if (!(await this.scores.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'ai_scores_not_ready',
        message: 'Apply RNOS-01 DDL before scoring',
      });
    }

    const requestId = input.correlationId?.trim() || this.audit.newRequestId();
    const entityId = String(input.leadId);

    if (!input.force) {
      const recent = await this.scores.findRecentAutoScore('lead', entityId);
      if (recent) {
        return this.toScoreResponse(recent, input.leadId, requestId, true, recent.agent_run_id ?? '');
      }
    }

    const ctx = await this.contextRepo.loadLeadScoreContext(input.leadId);
    if (!ctx) {
      throw new NotFoundException({ error: 'lead_not_found', lead_id: input.leadId });
    }

    const engineResult = computeLeadScoreV1(ctx);

    const wrapped = await this.audit.wrap(
      {
        useCase: AI_USE_CASE.SCORE_LEAD,
        entityType: 'lead',
        entityId,
        clientId: input.clientId ?? ctx.clientId,
        actorId: input.actorId ?? null,
        correlationId: requestId,
        modelName: LEAD_SCORE_MODEL,
        input: {
          lead_id: input.leadId,
          channel: ctx.channel,
          campaign_id: ctx.campaignId,
          features: engineResult.features,
        },
      },
      async () => ({
        data: engineResult,
        output: {
          score: engineResult.score,
          confidence: engineResult.confidence,
          score_band: engineResult.explainability.score_band,
        },
        modelName: LEAD_SCORE_MODEL,
        tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      }),
    );

    const row = await this.scores.insertScore({
      clientId: input.clientId ?? ctx.clientId,
      entityType: 'lead',
      entityId,
      scoreType: 'lead',
      scoreValue: wrapped.data.score,
      confidence: wrapped.data.confidence,
      features: wrapped.data.features,
      explainability: wrapped.data.explainability,
      agentRunId: wrapped.runId,
    });

    await this.events.emit(
      'LeadScored',
      'lead',
      entityId,
      {
        lead_id: input.leadId,
        score_id: row.id,
        score: row.score_value,
        confidence: row.confidence,
        agent_run_id: wrapped.runId,
        model: LEAD_SCORE_MODEL,
        model_version: LEAD_SCORE_MODEL_VERSION,
        canonical_event: 'tenant.lead.scored',
      },
      requestId,
      `LeadScored:lead:${entityId}:${LEAD_SCORE_MODEL_VERSION}`,
    );

    return this.toScoreResponse(row, input.leadId, requestId, false, wrapped.runId);
  }

  async listScores(
    entityType: string,
    entityId: string,
    limit?: number,
    requestId?: string,
  ): Promise<AiScoresListResponse> {
    if (!(await this.scores.tableReady())) {
      throw new ServiceUnavailableException({ error: 'ai_scores_not_ready' });
    }
    const scores = await this.scores.listScores(entityType, entityId, limit ?? 10);
    return {
      data: {
        entity_type: entityType,
        entity_id: entityId,
        scores,
        latest: scores[0] ?? null,
      },
      meta: { request_id: requestId ?? this.audit.newRequestId() },
      errors: [],
    };
  }

  private toScoreResponse(
    row: AiScoreRecord,
    leadId: number,
    requestId: string,
    idempotentReplay: boolean,
    agentRunId: string,
  ): ScoreLeadResponse {
    return {
      data: {
        score_id: row.id,
        lead_id: leadId,
        score: row.score_value,
        confidence: row.confidence ?? 0,
        score_band: row.explainability_json.score_band,
        explainability: row.explainability_json,
        model_name: row.model_name ?? LEAD_SCORE_MODEL,
        model_version: row.model_version,
        agent_run_id: agentRunId,
        calculated_at: row.calculated_at,
        idempotent_replay: idempotentReplay,
      },
      meta: { request_id: requestId },
      errors: [],
    };
  }
}
