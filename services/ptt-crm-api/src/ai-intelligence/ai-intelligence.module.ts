import { Module, forwardRef } from '@nestjs/common';
import { CrmLeadsLegacyModule } from '../crm-leads-legacy/crm-leads-legacy.module';
import { CustomerTimelineModule } from '../customer-timeline/customer-timeline.module';
import { EventsModule } from '../events/events.module';
import { LeadsModule } from '../leads/leads.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { AiAgentRunsRepository } from './ai-agent-runs.repository';
import { AiAgentRunsService } from './ai-agent-runs.service';
import { AiAuditService } from './ai-audit.service';
import { AiExecutionService } from './ai-execution.service';
import { AiLeadScoreService } from './ai-lead-score.service';
import { AiSummarizeService } from './ai-summarize.service';
import { AiRecommendationService } from './ai-recommendation.service';
import { AiRecommendationsRepository } from './ai-recommendations.repository';
import { AiScoresRepository } from './ai-scores.repository';
import { AiFeedbackAnalyticsService } from './ai-feedback-analytics.service';
import { AiIntelligenceConfigService } from './ai-intelligence.config';
import { AiIntelligenceController } from './ai-intelligence.controller';
import { AiIntelligenceService } from './ai-intelligence.service';
import { AiLlmClient } from './ai-llm.client';
import { AiPromptsRepository } from './ai-prompts.repository';
import { AiSummarizeRateLimitService } from './ai-summarize-rate-limit.service';
import { LeadScoreContextRepository } from './lead-score-context.repository';
import { StaffAiCopilotGuard } from './guards/staff-ai-copilot.guard';
import { StaffAiAdminGuard } from './guards/staff-ai-admin.guard';
import { StaffAiLeadAccessGuard } from './guards/staff-ai-lead-access.guard';

@Module({
  imports: [
    StaffAuthModule,
    CustomerTimelineModule,
    EventsModule,
    LeadsModule,
    forwardRef(() => CrmLeadsLegacyModule),
  ],
  controllers: [AiIntelligenceController],
  providers: [
    AiIntelligenceConfigService,
    AiAgentRunsRepository,
    AiAuditService,
    AiAgentRunsService,
    AiScoresRepository,
    LeadScoreContextRepository,
    AiLeadScoreService,
    AiSummarizeService,
    AiRecommendationService,
    AiFeedbackAnalyticsService,
    AiRecommendationsRepository,
    AiLlmClient,
    AiPromptsRepository,
    AiSummarizeRateLimitService,
    AiExecutionService,
    AiIntelligenceService,
    StaffAiCopilotGuard,
    StaffAiAdminGuard,
    StaffAiLeadAccessGuard,
  ],
  exports: [
    AiIntelligenceConfigService,
    AiAgentRunsRepository,
    AiAuditService,
    AiAgentRunsService,
    AiScoresRepository,
    LeadScoreContextRepository,
    AiLeadScoreService,
    AiSummarizeService,
    AiRecommendationService,
    AiFeedbackAnalyticsService,
    AiRecommendationsRepository,
    AiExecutionService,
    AiIntelligenceService,
    StaffAiCopilotGuard,
    StaffAiAdminGuard,
    StaffAiLeadAccessGuard,
  ],
})
export class AiIntelligenceModule {}
