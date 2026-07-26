import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CrmLeadsLegacyService } from '../crm-leads-legacy/crm-leads-legacy.service';
import { CrmLeadsSqliteRepository } from '../crm-leads-legacy/crm-leads-sqlite.repository';
import { PlaybooksRepository } from '../playbooks/playbooks.repository';
import { cosineSimilarity, embedPlaybookText, keywordScore } from '../playbooks/playbooks.types';
import { CasesSqliteRepository } from '../cases/cases-sqlite.repository';
import { AI_USE_CASE } from './ai-audit.constants';
import { AiAuditService } from './ai-audit.service';
import { AiRecommendationsRepository } from './ai-recommendations.repository';
import { AiScoresRepository } from './ai-scores.repository';
import { DealScoreContextRepository } from './deal-score-context.repository';
import { computeDealScoreV1 } from './deal-score.engine';
import {
  NextBestActionRequest,
  NextBestActionResponse,
} from './deal-score.types';
import { computeLeadNbaV1 } from './lead-nba.engine';
import { LeadScoreContextRepository } from './lead-score-context.repository';

const NBA_ACTIONS: Record<string, { label: string; taskTemplate: string; ragQuery: string }> = {
  call_back: {
    label: 'Gọi lại khách',
    taskTemplate: 'NBA: Gọi lại khách — lead đứng im',
    ragQuery: 'gọi lại lead stalled follow-up script',
  },
  send_follow_up: {
    label: 'Soạn follow-up',
    taskTemplate: 'NBA: Soạn follow-up cho lead',
    ragQuery: 'soạn follow-up zalo lead nurture',
  },
  send_proposal: {
    label: 'Gửi báo giá / proposal',
    taskTemplate: 'NBA: Gửi proposal cập nhật cho deal',
    ragQuery: 'gửi báo giá proposal deal',
  },
  escalate_gdkd: {
    label: 'Escalate GDKD',
    taskTemplate: 'NBA: Escalate GDKD — rủi ro cao',
    ragQuery: 'escalate gdkd lead hot priority',
  },
};

@Injectable()
export class AiNbaService {
  constructor(
    private readonly audit: AiAuditService,
    private readonly dealContext: DealScoreContextRepository,
    private readonly leadContext: LeadScoreContextRepository,
    private readonly leadSqlite: CrmLeadsSqliteRepository,
    private readonly scores: AiScoresRepository,
    private readonly recommendations: AiRecommendationsRepository,
    private readonly cases: CasesSqliteRepository,
    private readonly playbooks: PlaybooksRepository,
    private readonly crmLegacy: CrmLeadsLegacyService,
  ) {}

  async suggestNextBestAction(input: NextBestActionRequest): Promise<NextBestActionResponse> {
    const entityType = String(input.entity_type ?? (input.deal_id ? 'deal' : 'lead')).trim() || 'lead';
    if (entityType === 'lead') {
      return this.suggestLeadNextBestAction(input);
    }
    return this.suggestDealNextBestAction(input);
  }

  async executeNbaAccept(recommendationId: string, actorName?: string | null): Promise<number | null> {
    const rec = await this.recommendations.findById(recommendationId);
    if (!rec || rec.recommendation_type !== 'nba') {
      return null;
    }

    if (rec.entity_type === 'lead') {
      const leadId = Number(rec.entity_id);
      if (!Number.isFinite(leadId)) return null;
      const template = String(rec.action_json?.task_template ?? rec.recommendation_text);
      const cite = rec.action_json?.playbook_citation as Record<string, unknown> | undefined;
      const citeLine =
        cite?.playbook_title && cite?.chunk_title
          ? `Playbook: ${String(cite.playbook_title)} · ${String(cite.chunk_title)}`
          : 'Xem playbook tại /crm/playbooks';
      const { activity } = await this.crmLegacy.createActivity(
        leadId,
        {
          activity_type: 'note',
          content: `[NBA accepted${actorName ? ` · ${actorName}` : ''}] ${template}`,
          result: citeLine,
          next_action: 'Thực hiện theo playbook — không auto-send (BR-AI-01).',
        },
        actorName ?? 'staff',
        null,
      );
      return activity.id;
    }

    const dealId = Number(rec.entity_id);
    if (!Number.isFinite(dealId)) return null;
    const template = String(rec.action_json?.task_template ?? rec.recommendation_text);
    const body = `[NBA accepted${actorName ? ` · ${actorName}` : ''}] ${template}`;
    const event = this.cases.createEvent(dealId, body);
    return event.id;
  }

  private async suggestDealNextBestAction(input: NextBestActionRequest): Promise<NextBestActionResponse> {
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
        return this.toResponse(existing, 'deal', dealId, requestId);
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

    const action = this.pickDealAction(ctx.pipelineStage, scored.score);
    const actionMeta = NBA_ACTIONS[action] ?? NBA_ACTIONS.call_back;
    const reason = `Deal "${ctx.title}" đứng im ${scored.stalledDays} ngày ở stage ${ctx.pipelineStage}. Điểm deal ${Math.round(scored.score)}/100.`;
    const citation = await this.resolvePlaybookCitation(actionMeta.ragQuery);

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
        playbook_citation: citation,
      },
      confidence: wrapped.data.confidence,
      agentRunId: wrapped.runId,
    });

    return this.toResponse(record, 'deal', dealId, requestId, wrapped.runId);
  }

  private async suggestLeadNextBestAction(input: NextBestActionRequest): Promise<NextBestActionResponse> {
    if (!(await this.recommendations.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'ai_recommendations_not_ready',
        message: 'Apply RNOS-01 DDL before NBA',
      });
    }

    const leadId = Number(input.lead_id ?? input.entity_id);
    if (!Number.isFinite(leadId) || leadId <= 0) {
      throw new BadRequestException({ error: 'lead_id_required' });
    }

    const requestId = input.correlationId?.trim() || this.audit.newRequestId();

    if (!input.force) {
      const pending = await this.recommendations.listByEntity('lead', String(leadId), 'pending', 1);
      const existing = pending.find((r) => r.recommendation_type === 'nba');
      if (existing) {
        return this.toResponse(existing, 'lead', leadId, requestId);
      }
    }

    const ctx = await this.leadContext.loadLeadScoreContext(leadId);
    if (!ctx) {
      throw new NotFoundException({ error: 'lead_not_found', lead_id: leadId });
    }

    const terminal = ['won', 'lost', 'converted', 'closed'].includes(String(ctx.status ?? '').toLowerCase());
    if (terminal) {
      throw new BadRequestException({ error: 'lead_terminal', message: 'NBA not emitted for terminal leads' });
    }

    const latestScore = await this.scores.getLatest('lead', String(leadId));
    const lastActivityAt = this.leadSqlite.getLastStaffActivityAt(leadId);
    const evaluated = computeLeadNbaV1(ctx, {
      lastActivityAt,
      leadScore: latestScore?.score_value ?? null,
    });

    if (!evaluated.isStalled && !input.force) {
      throw new BadRequestException({
        error: 'lead_not_stalled',
        message: 'NBA chỉ phát khi lead chưa liên hệ ≥3 ngày hoặc không activity ≥7 ngày',
        stalled_days: evaluated.stalledDays,
      });
    }

    const action = this.pickLeadAction(ctx, latestScore?.score_value ?? null);
    const actionMeta = NBA_ACTIONS[action] ?? NBA_ACTIONS.call_back;
    const channel = ctx.channel ?? ctx.source ?? 'unknown';
    const reason = `Lead #${leadId} (${channel}) không cập nhật ${evaluated.stalledDays} ngày${
      latestScore ? ` · điểm ${Math.round(latestScore.score_value)}/100` : ''
    }.`;
    const citation = await this.resolvePlaybookCitation(
      `${actionMeta.ragQuery} ${channel} ${ctx.status ?? 'new'}`,
    );

    const wrapped = await this.audit.wrap(
      {
        useCase: AI_USE_CASE.NEXT_BEST_ACTION,
        entityType: 'lead',
        entityId: String(leadId),
        clientId: ctx.clientId,
        actorId: input.actorId ?? null,
        correlationId: requestId,
        modelName: 'nba-rules-v1',
        input: {
          lead_id: leadId,
          action,
          stalled_days: evaluated.stalledDays,
          lead_score: latestScore?.score_value ?? null,
        },
      },
      async () => ({
        data: { action, reason, confidence: evaluated.confidence },
        output: { action, reason },
        modelName: 'nba-rules-v1',
        tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      }),
    );

    const record = await this.recommendations.insert({
      entityType: 'lead',
      entityId: String(leadId),
      recommendationType: 'nba',
      text: `${actionMeta.label}: ${reason}`,
      actionJson: {
        action,
        action_label: actionMeta.label,
        task_template: actionMeta.taskTemplate,
        reason,
        stalled_days: evaluated.stalledDays,
        lead_score: latestScore?.score_value ?? null,
        playbook_citation: citation,
      },
      confidence: wrapped.data.confidence,
      agentRunId: wrapped.runId,
    });

    return this.toResponse(record, 'lead', leadId, requestId, wrapped.runId);
  }

  private async resolvePlaybookCitation(query: string): Promise<Record<string, unknown> | null> {
    const q = String(query ?? '').trim();
    if (q.length < 2) return null;
    try {
      if (!(await this.playbooks.tableReady())) return null;
      await this.playbooks.ensureSeedData();
      const rows = await this.playbooks.listAllChunks();
      if (!rows.length) return null;
      const queryVec = embedPlaybookText(q);
      const top = rows
        .map((row) => {
          const emb = row.embedding_json ?? embedPlaybookText(`${row.title} ${row.body}`);
          const vectorScore = cosineSimilarity(queryVec, emb);
          const kw = keywordScore(q, `${row.title} ${row.body}`);
          return { row, score: vectorScore * 0.7 + Math.min(kw, 3) * 0.1 };
        })
        .sort((a, b) => b.score - a.score)[0];
      if (!top || top.score <= 0) return null;
      const excerpt = top.row.body.trim().slice(0, 160);
      return {
        playbook_id: top.row.playbook_id,
        playbook_title: top.row.playbook_title,
        chunk_id: top.row.id,
        chunk_title: top.row.title,
        excerpt,
        score: top.score,
      };
    } catch {
      return null;
    }
  }

  private pickDealAction(stage: string, score: number): string {
    if (score < 35) return 'escalate_gdkd';
    if (stage === 'bao_gia' || stage === 'sql') return 'send_proposal';
    return 'call_back';
  }

  private pickLeadAction(ctx: { status: string | null; timelineEventCount: number }, leadScore: number | null): string {
    if (leadScore != null && leadScore < 35) return 'escalate_gdkd';
    if ((leadScore ?? 0) >= 70 && !ctx.timelineEventCount) return 'call_back';
    if (String(ctx.status ?? '').toLowerCase() === 'new') return 'call_back';
    return 'send_follow_up';
  }

  private toResponse(
    record: Awaited<ReturnType<AiRecommendationsRepository['insert']>>,
    entityType: 'lead' | 'deal',
    entityId: number,
    requestId: string,
    agentRunId?: string,
  ): NextBestActionResponse {
    const action = String(record.action_json?.action ?? 'call_back');
    const actionLabel = String(record.action_json?.action_label ?? NBA_ACTIONS[action]?.label ?? action);
    const citationRaw = record.action_json?.playbook_citation as Record<string, unknown> | null | undefined;
    const playbook_citation =
      citationRaw?.playbook_id && citationRaw?.playbook_title
        ? {
            playbook_id: String(citationRaw.playbook_id),
            playbook_title: String(citationRaw.playbook_title),
            chunk_id: String(citationRaw.chunk_id ?? ''),
            chunk_title: String(citationRaw.chunk_title ?? ''),
            excerpt: String(citationRaw.excerpt ?? ''),
          }
        : null;

    return {
      data: {
        recommendation_id: record.id,
        entity_type: entityType,
        entity_id: entityId,
        ...(entityType === 'deal' ? { deal_id: entityId } : { lead_id: entityId }),
        action,
        action_label: actionLabel,
        reason: String(record.action_json?.reason ?? record.recommendation_text),
        confidence: record.confidence ?? 0.6,
        status: record.status,
        recommendation_text: record.recommendation_text,
        agent_run_id: agentRunId ?? record.agent_run_id ?? '',
        playbook_citation,
      },
      meta: { request_id: requestId },
      errors: [],
    };
  }
}
