import { randomUUID } from 'crypto';
import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { AiAgentRunsService, AiAgentRunDetailResponse, AiAgentRunListResponse } from './ai-agent-runs.service';
import { AiDealScoreService } from './ai-deal-score.service';
import { AiLeadScoreService } from './ai-lead-score.service';
import { AiNbaService } from './ai-nba.service';
import { PipelineRiskService } from './pipeline-risk.service';
import { AiForecastService } from './ai-forecast.service';
import { AiSummarizeService } from './ai-summarize.service';
import { AiRecommendationService } from './ai-recommendation.service';
import { AiFeedbackAnalyticsService } from './ai-feedback-analytics.service';
import { AiIntelligenceService } from './ai-intelligence.service';
import { AiAgentRunStatus, AiHealthResponse } from './ai-intelligence.types';
import { ScoreDealResponse } from './deal-score.types';
import {
  PipelineRiskListResponse,
  PipelineRiskScanResponse,
} from './pipeline-risk.types';
import {
  ForecastCommitResponse,
  ForecastDashboardResponse,
  ForecastSnapshotResponse,
} from './forecast.types';
import { AiScoresBatchResponse, AiScoresListResponse, ScoreLeadResponse } from './lead-score.types';
import { SummarizeResponse } from './summarize.types';
import {
  RecommendationListResponse,
  RecommendationResponse,
  RecommendationStatus,
} from './recommendation.types';
import {
  AiAcceptanceMetricsResponse,
  AiRecommendationInboxResponse,
} from './feedback-analytics.types';
import { StaffAiCopilotGuard } from './guards/staff-ai-copilot.guard';
import { StaffAiAdminGuard } from './guards/staff-ai-admin.guard';
import { StaffAiDealAccessGuard } from './guards/staff-ai-deal-access.guard';
import { StaffAiLeadAccessGuard } from './guards/staff-ai-lead-access.guard';
import { StaffAiScoreOverrideGuard } from './guards/staff-ai-score-override.guard';
import { StaffAiScoresBatchGuard } from './guards/staff-ai-scores-batch.guard';
import { StaffAiForecastCommitGuard } from './guards/staff-ai-forecast-commit.guard';
import { StaffAiForecastViewGuard } from './guards/staff-ai-forecast-view.guard';

interface ScoreDealBody {
  deal_id: number;
  force?: boolean;
}

interface NextBestActionBody {
  deal_id?: number;
  lead_id?: number;
  entity_type?: string;
  entity_id?: string | number;
  force?: boolean;
}

interface ScoreLeadBody {
  lead_id: number;
  force?: boolean;
}

interface OverrideLeadScoreBody {
  lead_id: number;
  score: number;
  override_reason: string;
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
    private readonly dealScore: AiDealScoreService,
    private readonly nba: AiNbaService,
    private readonly summarize: AiSummarizeService,
    private readonly recommendations: AiRecommendationService,
    private readonly feedbackAnalytics: AiFeedbackAnalyticsService,
    private readonly pipelineRisk: PipelineRiskService,
    private readonly forecast: AiForecastService,
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
  @UseGuards(StaffOrInternalKeyGuard, StaffAiAdminGuard)
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
  @UseGuards(StaffOrInternalKeyGuard, StaffAiAdminGuard)
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

  /** AI-UC-006 / UI-R1-08 — GDKD manual score override (BR-AI-05). */
  @Post('scores/lead/override')
  @UseGuards(
    StaffOrInternalKeyGuard,
    StaffAiCopilotGuard,
    StaffAiLeadAccessGuard,
    StaffAiScoreOverrideGuard,
  )
  overrideLeadScore(
    @Body() body: OverrideLeadScoreBody,
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
    const actorEmail = req.staffUser?.email ?? null;
    return this.leadScore.overrideLeadScore({
      leadId: Number(body.lead_id),
      score: Number(body.score),
      overrideReason: body.override_reason ?? '',
      actorId,
      actorEmail,
      correlationId: rid,
    });
  }

  /** RNOS-09 — deal score rules v1 (AI-UC-012). */
  @Post('score/deal')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiDealAccessGuard)
  scoreDeal(
    @Body() body: ScoreDealBody,
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<ScoreDealResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    return this.dealScore.scoreDeal({
      dealId: Number(body.deal_id),
      force: Boolean(body.force),
      actorId,
      correlationId: rid,
    });
  }

  /** RNOS-10 / AI-UC-011 — next best action for stalled deal or lead. */
  @Post('next-best-action')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiLeadAccessGuard)
  nextBestAction(
    @Body() body: NextBestActionBody,
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    const entityType = String(body.entity_type ?? (body.deal_id ? 'deal' : 'lead')).trim() || 'lead';
    return this.nba.suggestNextBestAction({
      deal_id: body.deal_id != null ? Number(body.deal_id) : undefined,
      lead_id: body.lead_id != null ? Number(body.lead_id) : undefined,
      entity_type: entityType,
      entity_id: body.entity_id ?? body.lead_id ?? body.deal_id,
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

  /** RNOS-04 / AI-UC-012 — batch scores (lead pilot cohort; deal sales funnel cap). */
  @Get('scores/batch')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiScoresBatchGuard)
  async listScoresBatch(
    @Query('entity_type') entityType: string,
    @Query('entity_ids') entityIdsRaw: string,
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<AiScoresBatchResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const type = entityType || 'lead';
    const entityIds = String(entityIdsRaw ?? '')
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (type === 'deal') {
      const scoresByEntityId = await this.dealScore.listDealScoresBatch(entityIds, rid);
      return {
        data: { entity_type: 'deal', scores_by_entity_id: scoresByEntityId },
        meta: { request_id: rid ?? randomUUID() },
        errors: [],
      };
    }

    return this.leadScore.listScoresBatch(type, entityIds, req.staffUser, req.staffAuthVia, rid);
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

  /** RNOS-29 — AI acceptance feedback analytics (G6 KPI). */
  @Get('analytics/acceptance')
  @UseGuards(StaffOrInternalKeyGuard)
  getAcceptanceAnalytics(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('days') days?: string,
    @Query('recommendation_type') recommendationType?: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<AiAcceptanceMetricsResponse> {
    return this.feedbackAnalytics.getAcceptanceMetrics(
      {
        from,
        to,
        days: days ? Number(days) : undefined,
        recommendation_type: recommendationType,
      },
      correlationId?.trim() || requestId?.trim() || undefined,
    );
  }

  /** RNOS-29 — feedback inbox for managers (accept/dismiss history). */
  @Get('recommendations/inbox')
  @UseGuards(StaffOrInternalKeyGuard)
  listRecommendationsInbox(
    @Query('status') status?: RecommendationStatus,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('days') days?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<AiRecommendationInboxResponse> {
    return this.feedbackAnalytics.listInbox(
      {
        status,
        from,
        to,
        days: days ? Number(days) : undefined,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      },
      correlationId?.trim() || requestId?.trim() || undefined,
    );
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

  /** RNOS-23 / AI-UC-015 — daily pipeline risk scan (internal cron or GDKD). */
  @Post('pipeline-risk/scan')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiDealAccessGuard)
  scanPipelineRisk(
    @Body() body: { limit?: number },
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<PipelineRiskScanResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    return this.pipelineRisk.scanDaily({
      limit: body?.limit,
      actorId,
      correlationId: rid,
    });
  }

  /** RNOS-23 / AI-UC-015 — at-risk deals for GDKD insights. */
  @Get('pipeline-risk/at-risk')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiDealAccessGuard)
  listPipelineRiskDeals(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<PipelineRiskListResponse> {
    return this.pipelineRisk.listAtRiskDeals(
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
    );
  }

  /** RNOS-17 / AI-UC-013 — daily revenue forecast snapshot (cron 07:00 ICT). */
  @Post('forecast')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiForecastViewGuard)
  generateForecastSnapshot(
    @Body() body: { force?: boolean; snapshot_date?: string },
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<ForecastSnapshotResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    return this.forecast.generateSnapshot({
      force: Boolean(body?.force),
      snapshotDate: body?.snapshot_date,
      actorId,
      correlationId: rid,
    });
  }

  /** RNOS-18 / UI-R3-01 — GDKD forecast dashboard for current month. */
  @Get('forecast/current')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiForecastViewGuard)
  getForecastDashboard(
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<ForecastDashboardResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    return this.forecast.getDashboard(
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
      rid,
    );
  }

  /** RNOS-18 / UI-R3-02 — GDKD commit forecast VND (BR: no auto-commit). */
  @Patch('forecast/commit')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiForecastCommitGuard)
  commitForecast(
    @Body()
    body: {
      snapshot_id: string;
      committed_amount_vnd: number;
      acknowledge_mape_warning?: boolean;
    },
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<ForecastCommitResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    return this.forecast.commitForecast({
      snapshotId: body.snapshot_id,
      committedAmountVnd: Number(body.committed_amount_vnd),
      acknowledgeMapeWarning: Boolean(body.acknowledge_mape_warning),
      actorId,
      actorEmail: req.staffUser?.email ?? null,
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
