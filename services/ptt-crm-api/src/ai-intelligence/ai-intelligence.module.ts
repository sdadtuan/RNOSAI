import { ConfigModule } from '../config/config.module';
import { Module, forwardRef } from '@nestjs/common';
import { PlaybooksRepository } from '../playbooks/playbooks.repository';
import { CasesModule } from '../cases/cases.module';
import { CrmConfigModule } from '../crm-config/crm-config.module';
import { CrmLeadsLegacyModule } from '../crm-leads-legacy/crm-leads-legacy.module';
import { CustomerTimelineModule } from '../customer-timeline/customer-timeline.module';
import { EventsModule } from '../events/events.module';
import { LeadsModule } from '../leads/leads.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { AiAgentRunsRepository } from './ai-agent-runs.repository';
import { AiAgentRunsService } from './ai-agent-runs.service';
import { AiAuditService } from './ai-audit.service';
import { AiDealScoreService } from './ai-deal-score.service';
import { AiExecutionService } from './ai-execution.service';
import { AiFeedbackAnalyticsService } from './ai-feedback-analytics.service';
import { AiIntelligenceConfigService } from './ai-intelligence.config';
import { AiIntelligenceController } from './ai-intelligence.controller';
import { AiIntelligenceService } from './ai-intelligence.service';
import { AiLeadScoreService } from './ai-lead-score.service';
import { AiLlmClient } from './ai-llm.client';
import { AiNbaService } from './ai-nba.service';
import { PipelineRiskService } from './pipeline-risk.service';
import { AiPromptsRepository } from './ai-prompts.repository';
import { AiRecommendationService } from './ai-recommendation.service';
import { AiRecommendationsRepository } from './ai-recommendations.repository';
import { AiScoresRepository } from './ai-scores.repository';
import { AiSummarizeRateLimitService } from './ai-summarize-rate-limit.service';
import { AiSummarizeService } from './ai-summarize.service';
import { DealScoreContextRepository } from './deal-score-context.repository';
import { StaffAiAdminGuard } from './guards/staff-ai-admin.guard';
import { StaffAiCopilotGuard } from './guards/staff-ai-copilot.guard';
import { StaffAiDealAccessGuard } from './guards/staff-ai-deal-access.guard';
import { StaffAiLeadAccessGuard } from './guards/staff-ai-lead-access.guard';
import { StaffAiScoreOverrideGuard } from './guards/staff-ai-score-override.guard';
import { StaffAiScoresBatchGuard } from './guards/staff-ai-scores-batch.guard';
import { LeadScoreContextRepository } from './lead-score-context.repository';

@Module({
  imports: [
    StaffAuthModule,
    ConfigModule,
    CustomerTimelineModule,
    EventsModule,
    LeadsModule,
    CrmConfigModule,
    CasesModule,
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
    DealScoreContextRepository,
    AiLeadScoreService,
    AiDealScoreService,
    AiNbaService,
    PipelineRiskService,
    PlaybooksRepository,
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
    StaffAiDealAccessGuard,
    StaffAiScoreOverrideGuard,
    StaffAiScoresBatchGuard,
  ],
  exports: [
    AiIntelligenceConfigService,
    AiAgentRunsRepository,
    AiAuditService,
    AiAgentRunsService,
    AiScoresRepository,
    LeadScoreContextRepository,
    DealScoreContextRepository,
    AiLeadScoreService,
    AiDealScoreService,
    AiNbaService,
    PipelineRiskService,
    AiSummarizeService,
    AiRecommendationService,
    AiFeedbackAnalyticsService,
    AiRecommendationsRepository,
    AiExecutionService,
    AiIntelligenceService,
    StaffAiCopilotGuard,
    StaffAiAdminGuard,
    StaffAiLeadAccessGuard,
    StaffAiDealAccessGuard,
    StaffAiScoreOverrideGuard,
    StaffAiScoresBatchGuard,
  ],
})
export class AiIntelligenceModule {}
