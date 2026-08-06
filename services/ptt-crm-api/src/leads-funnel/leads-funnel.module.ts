import { forwardRef, Module } from '@nestjs/common';
import { AiIntelligenceModule } from '../ai-intelligence/ai-intelligence.module';
import { CrmLeadsLegacyModule } from '../crm-leads-legacy/crm-leads-legacy.module';
import { CskhBoardModule } from '../cskh-board/cskh-board.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { LeadsModule } from '../leads/leads.module';
import { LeadsFunnelController } from './leads-funnel.controller';
import { LeadsFunnelService } from './leads-funnel.service';
import { LeadsFunnelPgRepository } from './leads-funnel-pg.repository';
import { LeadsFunnelSqliteRepository } from './leads-funnel-sqlite.repository';
import { LeadsFunnelEnabledGuard, PresalesOnLeadGuard } from './guards/leads-funnel-enabled.guard';
import { LeadNotInReviewQueueGuard } from './guards/lead-not-in-review-queue.guard';
import { StaffLeadsGdkdGuard } from './guards/staff-leads-gdkd.guard';
import {
  StaffPresalesSolutionClaimGuard,
  StaffPresalesSolutionQueueGuard,
  StaffPresalesSolutionReleaseGuard,
} from './guards/staff-presales-solution.guard';
import { IntakeModule } from '../intake/intake.module';
import { ReviewQueueLlmService } from './review-queue-llm.service';

@Module({
  imports: [
    StaffAuthModule,
    forwardRef(() => LeadsModule),
    forwardRef(() => CrmLeadsLegacyModule),
    forwardRef(() => CskhBoardModule),
    forwardRef(() => AiIntelligenceModule),
    forwardRef(() => IntakeModule),
  ],
  controllers: [LeadsFunnelController],
  providers: [
    LeadsFunnelService,
    LeadsFunnelSqliteRepository,
    LeadsFunnelPgRepository,
    ReviewQueueLlmService,
    LeadsFunnelEnabledGuard,
    PresalesOnLeadGuard,
    StaffLeadsGdkdGuard,
    LeadNotInReviewQueueGuard,
    StaffPresalesSolutionClaimGuard,
    StaffPresalesSolutionReleaseGuard,
    StaffPresalesSolutionQueueGuard,
  ],
  exports: [LeadsFunnelService, LeadsFunnelSqliteRepository, LeadsFunnelPgRepository, LeadNotInReviewQueueGuard],
})
export class LeadsFunnelModule {}
