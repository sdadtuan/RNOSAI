import { Injectable } from '@nestjs/common';
import { CustomerTimelineService } from '../customer-timeline/customer-timeline.service';
import { AI_USE_CASE } from './ai-audit.constants';
import { AiAuditService } from './ai-audit.service';
import { AiIntelligenceConfigService } from './ai-intelligence.config';
import { AiLeadScoreService } from './ai-lead-score.service';
import { AiAuditContext, AiAuditWrapResult } from './ai-intelligence.types';
import { ScoreLeadResponse } from './lead-score.types';

/**
 * RNOS-05/04 — audited execution entry points.
 */
@Injectable()
export class AiExecutionService {
  constructor(
    private readonly leadScore: AiLeadScoreService,
    private readonly audit: AiAuditService,
    private readonly aiConfig: AiIntelligenceConfigService,
    private readonly timeline: CustomerTimelineService,
  ) {}

  /** RNOS-04 — score lead via rules engine (worker + API). */
  scoreLead(
    ctx: Omit<AiAuditContext, 'useCase'>,
    leadId: string | number,
    options?: { force?: boolean },
  ): Promise<ScoreLeadResponse> {
    return this.leadScore.scoreLead({
      leadId: Number(leadId),
      force: options?.force,
      actorId: ctx.actorId ?? null,
      correlationId: ctx.correlationId ?? null,
      clientId: ctx.clientId ?? null,
    });
  }

  /** RNOS-03 prep — LLM stub with timeline context. */
  async summarizeStub(
    ctx: Omit<AiAuditContext, 'useCase'>,
    text: string,
    entityType?: string,
    entityId?: string,
  ): Promise<AiAuditWrapResult<{ summary: string; extracted: Record<string, unknown> }>> {
    const timelineItems =
      entityType && entityId
        ? await this.timeline.buildAiContext(entityType, entityId, 15)
        : [];
    return this.audit.wrap(
      {
        ...ctx,
        useCase: AI_USE_CASE.SUMMARIZE,
        entityType: entityType ?? ctx.entityType,
        entityId: entityId ?? ctx.entityId,
        input: { text, chars: text.length, timeline_events: timelineItems.length },
      },
      async () => {
        const summary = `[stub] ${text.slice(0, 120)}${text.length > 120 ? '…' : ''}`;
        return {
          data: {
            summary,
            extracted: { intent: 'unknown', stub: true, timeline_refs: timelineItems.length },
          },
          output: { summary_len: summary.length, timeline_refs: timelineItems.length },
          modelName: this.aiConfig.llmModel,
          tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        };
      },
    );
  }
}
