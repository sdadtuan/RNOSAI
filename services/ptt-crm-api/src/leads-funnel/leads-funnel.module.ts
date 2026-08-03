import { forwardRef, Module } from '@nestjs/common';
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

@Module({
  imports: [StaffAuthModule, forwardRef(() => LeadsModule), CrmLeadsLegacyModule, CskhBoardModule],
  controllers: [LeadsFunnelController],
  providers: [
    LeadsFunnelService,
    LeadsFunnelSqliteRepository,
    LeadsFunnelPgRepository,
    LeadsFunnelEnabledGuard,
    PresalesOnLeadGuard,
    StaffLeadsGdkdGuard,
    LeadNotInReviewQueueGuard,
  ],
  exports: [LeadsFunnelService, LeadsFunnelSqliteRepository, LeadsFunnelPgRepository, LeadNotInReviewQueueGuard],
})
export class LeadsFunnelModule {}
