import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DomainEventService } from '../events/domain-event.service';
import { LeadsRepository } from '../leads/leads.repository';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { AI_USE_CASE } from './ai-audit.constants';
import { AiAuditService } from './ai-audit.service';
import { AiScoreRecord } from './lead-score.types';
import { AiScoresRepository } from './ai-scores.repository';
import { computeLeadScoreV1 } from './lead-score.engine';
import { LeadScoreContextRepository } from './lead-score-context.repository';
import {
  AiScoresBatchResponse,
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
    private readonly leads: LeadsRepository,
    private readonly staffAuth: StaffAuthService,
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

  /** UI-R1-10 — batch latest scores for leads list (BR-AI-04 filtered). */
  async listScoresBatch(
    entityType: string,
    entityIds: number[],
    staffUser: StaffJwtPayload | undefined,
    authVia: 'internal' | 'jwt' | undefined,
    requestId?: string,
  ): Promise<AiScoresBatchResponse> {
    if (!(await this.scores.tableReady())) {
      throw new ServiceUnavailableException({ error: 'ai_scores_not_ready' });
    }

    const uniqueIds = [...new Set(entityIds.filter((id) => Number.isFinite(id) && id > 0))].slice(0, 50);
    const allowedIds = await this.filterAccessibleLeadIds(uniqueIds, staffUser, authVia);
    const rows = await this.scores.listLatestForEntities(entityType || 'lead', allowedIds.map(String));

    const scoresByEntityId: Record<string, AiScoreRecord> = {};
    for (const row of rows) {
      scoresByEntityId[row.entity_id] = row;
    }

    return {
      data: {
        entity_type: entityType || 'lead',
        scores_by_entity_id: scoresByEntityId,
      },
      meta: { request_id: requestId ?? this.audit.newRequestId() },
      errors: [],
    };
  }

  private async filterAccessibleLeadIds(
    leadIds: number[],
    staffUser: StaffJwtPayload | undefined,
    authVia: 'internal' | 'jwt' | undefined,
  ): Promise<number[]> {
    if (!leadIds.length) {
      return [];
    }
    if (authVia === 'internal') {
      return leadIds;
    }
    if (!staffUser) {
      return [];
    }

    const me = await this.staffAuth.me(staffUser);
    if (this.staffAuth.hasCap(me.caps, 'crm_leads', 'assign')) {
      return leadIds;
    }

    const staffId = Number(staffUser.sub);
    const allowed: number[] = [];
    for (const leadId of leadIds) {
      const lead = await this.leads.getLeadById(leadId);
      if (lead?.owner_id != null && lead.owner_id === staffId) {
        allowed.push(leadId);
      }
    }
    return allowed;
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
