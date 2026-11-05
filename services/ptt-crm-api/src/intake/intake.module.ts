import { Module, forwardRef } from '@nestjs/common';
import { B2bProjectsModule } from '../b2b-projects/b2b-projects.module';
import { LeadsModule } from '../leads/leads.module';
import { LeadsFunnelModule } from '../leads-funnel/leads-funnel.module';
import { LeadMeetingPrepAsyncModule } from '../lead-meeting-prep/lead-meeting-prep-async.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { AiAgentRunsRepository } from '../ai-intelligence/ai-agent-runs.repository';
import { AiIntelligenceConfigService } from '../ai-intelligence/ai-intelligence.config';
import { AiLlmClient } from '../ai-intelligence/ai-llm.client';
import { AiSummarizeRateLimitService } from '../ai-intelligence/ai-summarize-rate-limit.service';
import { StaffIntakeViewGuard, StaffIntakeWriteGuard } from './guards/staff-intake.guard';
import { IntakeB2bVisibilityService } from './intake-b2b-visibility.service';
import { IntakeController } from './intake.controller';
import { IntakeSalesKitLlmService } from './intake-sales-kit-llm.service';
import { IntakeScoreSuggestService } from './intake-score-suggest.service';
import { IntakeService } from './intake.service';
import { IntakePgRepository } from './intake-pg.repository';
import { SalesKitLearnRepository } from './sales-kit-learn.repository';
import { SalesKitLearnService } from './sales-kit-learn.service';
import { SalesKitLibraryRepository } from './sales-kit-library.repository';
import { SalesKitLibraryService } from './sales-kit-library.service';
import { SalesKitRuntimeRepository } from './sales-kit-runtime.repository';
import { SalesKitRuntimeService } from './sales-kit-runtime.service';
import { SalesKitTurnsRepository } from './sales-kit-turns.repository';

@Module({
  imports: [
    StaffAuthModule,
    B2bProjectsModule,
    forwardRef(() => LeadsModule),
    forwardRef(() => LeadsFunnelModule),
    LeadMeetingPrepAsyncModule,
  ],
  controllers: [IntakeController],
  providers: [
    IntakeService,
    IntakeB2bVisibilityService,
    IntakePgRepository,
    StaffIntakeViewGuard,
    StaffIntakeWriteGuard,
    SalesKitLibraryRepository,
    SalesKitLibraryService,
    IntakeSalesKitLlmService,
    IntakeScoreSuggestService,
    SalesKitTurnsRepository,
    SalesKitRuntimeRepository,
    SalesKitRuntimeService,
    SalesKitLearnRepository,
    SalesKitLearnService,
    AiSummarizeRateLimitService,
    AiIntelligenceConfigService,
    AiLlmClient,
    AiAgentRunsRepository,
  ],
  exports: [IntakeService, IntakePgRepository, SalesKitLibraryService],
})
export class IntakeModule {}
