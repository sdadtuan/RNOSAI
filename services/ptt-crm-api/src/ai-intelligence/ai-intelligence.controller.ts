import { randomUUID } from 'crypto';
import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { AiAgentRunsService, AiAgentRunDetailResponse, AiAgentRunListResponse } from './ai-agent-runs.service';
import { AiLeadScoreService } from './ai-lead-score.service';
import { AiSummarizeService } from './ai-summarize.service';
import { AiRecommendationService } from './ai-recommendation.service';
import { AiIntelligenceService } from './ai-intelligence.service';
import { AiAgentRunStatus, AiHealthResponse } from './ai-intelligence.types';
import { AiScoresListResponse, ScoreLeadResponse } from './lead-score.types';
import { SummarizeResponse } from './summarize.types';
import {
  RecommendationListResponse,
  RecommendationResponse,
  RecommendationStatus,
} from './recommendation.types';
import { StaffAiCopilotGuard } from './guards/staff-ai-copilot.guard';
import { StaffAiLeadAccessGuard } from './guards/staff-ai-lead-access.guard';

interface ScoreLeadBody {
  lead_id: number;
  force?: boolean;
}

interface SummarizeBody {
  entity_type?: string;
  entity_id?: string | number;
  text?: string;
  context?: string;
}

interface RecommendationBody {
  type?: string;
  entity_type?: string;
  entity_id?: string | number;
  channel_hint?: string;
  context_text?: string;
}

interface PatchRecommendationBody {
  status?: 'accepted' | 'dismissed';
  final_text?: string;
  dismiss_reason?: string;
}

@Controller('api/v1/ai')
export class AiIntelligenceController {
  constructor(
    private readonly ai: AiIntelligenceService,
    private readonly runs: AiAgentRunsService,
    private readonly leadScore: AiLeadScoreService,
    private readonly summarize: AiSummarizeService,
    private readonly recommendations: AiRecommendationService,
  ) {}

  /** RNOS-02 — public smoke; records ai_agent_runs when schema ready (RNOS-05). */
  @Get('health')
  getHealth(
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<AiHealthResponse> {
    return this.ai.getHealth(correlationId?.trim() || requestId?.trim() || undefined);
  }

  /** RNOS-05 / AI-UC-009 — admin audit trail (BR-AI-05 redaction applied). */
  @Get('runs')
  @UseGuards(StaffOrInternalKeyGuard)
  listRuns(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('use_case') useCase?: string,
    @Query('actor_id') actorId?: string,
    @Query('entity_type') entityType?: string,
    @Query('entity_id') entityId?: string,
    @Query('status') status?: AiAgentRunStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<AiAgentRunListResponse> {
    return this.runs.list(
      {
        from,
        to,
        useCase,
        actorId,
        entityType,
        entityId,
        status,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      },
      correlationId?.trim() || requestId?.trim() || undefined,
    );
  }

  @Get('runs/:id')
  @UseGuards(StaffOrInternalKeyGuard)
  getRun(
    @Param('id') id: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<AiAgentRunDetailResponse> {
    return this.runs.getById(id, correlationId?.trim() || requestId?.trim() || undefined);
  }

  /** RNOS-04 — rules engine v1 + explainability (AI-UC-001, AI-UC-005). */
  @Post('score/lead')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiCopilotGuard, StaffAiLeadAccessGuard)
  scoreLead(
    @Body() body: ScoreLeadBody,
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<ScoreLeadResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    return this.leadScore.scoreLead({
      leadId: Number(body.lead_id),
      force: Boolean(body.force),
      actorId,
      correlationId: rid,
    });
  }

  /** RNOS-03 — summarize activity / lead brief (AI-UC-002, AI-UC-003). */
  @Post('summarize')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiCopilotGuard, StaffAiLeadAccessGuard)
  summarizeText(
    @Body() body: SummarizeBody,
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<SummarizeResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    const entityType = body.entity_type?.trim() || (body.entity_id ? 'lead' : undefined);
    return this.summarize.summarize({
      context: (body.context?.trim() || 'activity') as 'lead_brief' | 'activity',
      entityType,
      entityId: body.entity_id != null ? String(body.entity_id) : undefined,
      text: body.text,
      actorId,
      correlationId: rid,
    });
  }

  /** RNOS-04 — poll latest scores for Copilot (ops-web). */
  @Get('scores')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiCopilotGuard, StaffAiLeadAccessGuard)
  listScores(
    @Query('entity_type') entityType: string,
    @Query('entity_id') entityId: string,
    @Query('limit') limit?: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<AiScoresListResponse> {
    return this.leadScore.listScores(
      entityType || 'lead',
      entityId,
      limit ? Number(limit) : undefined,
      correlationId?.trim() || requestId?.trim() || undefined,
    );
  }

  /** RNOS-07 — follow-up draft generate (AI-UC-004, BR-AI-01 no auto-send). */
  @Post('recommendation')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiCopilotGuard, StaffAiLeadAccessGuard)
  createRecommendation(
    @Body() body: RecommendationBody,
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<RecommendationResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    const actorName = req.staffUser?.email ?? null;
    const actorUserId = req.staffUser?.sub ? Number(req.staffUser.sub) : null;
    const entityType = body.entity_type?.trim() || 'lead';
    return this.recommendations.createFollowUpDraft({
      type: body.type?.trim() || 'follow_up_draft',
      entityType,
      entityId: body.entity_id != null ? String(body.entity_id) : '',
      channelHint: body.channel_hint as 'zalo' | 'email' | 'note' | undefined,
      contextText: body.context_text,
      actorId,
      actorName,
      actorUserId,
      correlationId: rid,
    });
  }

  /** RNOS-07 — list recommendations for entity. */
  @Get('recommendations')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiCopilotGuard, StaffAiLeadAccessGuard)
  listRecommendations(
    @Query('entity_type') entityType: string,
    @Query('entity_id') entityId: string,
    @Query('status') status?: RecommendationStatus,
    @Query('limit') limit?: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<RecommendationListResponse> {
    return this.recommendations.listRecommendations(
      entityType || 'lead',
      entityId,
      status,
      limit ? Number(limit) : undefined,
      correlationId?.trim() || requestId?.trim() || undefined,
    );
  }

  /** RNOS-07 — accept/dismiss draft; accept creates CRM activity note only. */
  @Patch('recommendations/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiCopilotGuard, StaffAiLeadAccessGuard)
  patchRecommendation(
    @Param('id') id: string,
    @Body() body: PatchRecommendationBody,
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<RecommendationResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    const actorName = req.staffUser?.email ?? null;
    const actorUserId = req.staffUser?.sub ? Number(req.staffUser.sub) : null;
    return this.recommendations.patchRecommendation(id, {
      status: body.status as 'accepted' | 'dismissed',
      finalText: body.final_text,
      dismissReason: body.dismiss_reason,
      actorId,
      actorName,
      actorUserId,
      correlationId: rid,
    });
  }

  /** Guard wiring check — requires copilot flag + pilot cohort (BR-AI-04 prep). */
  @Get('copilot/ping')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiCopilotGuard)
  copilotPing(): { data: { ok: true; message: string }; meta: { request_id: string }; errors: [] } {
    return {
      data: { ok: true, message: 'copilot guard passed' },
      meta: { request_id: randomUUID() },
      errors: [],
    };
  }
}
