import { forwardRef, Module } from '@nestjs/common';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { LeadsModule } from '../leads/leads.module';
import { LeadMeetingPrepController } from './lead-meeting-prep.controller';
import { LeadMeetingPrepEnqueueService } from './lead-meeting-prep-enqueue.service';
import { LeadMeetingPrepInputResolver } from './lead-meeting-prep-input.resolver';
import { LeadMeetingPrepRepository } from './lead-meeting-prep.repository';
import { LeadMeetingPrepService } from './lead-meeting-prep.service';
import { LeadMeetingPrepEnabledGuard } from './guards/lead-meeting-prep-enabled.guard';

@Module({
  imports: [WebhooksModule, StaffAuthModule, forwardRef(() => LeadsModule)],
  controllers: [LeadMeetingPrepController],
  providers: [
    LeadMeetingPrepRepository,
    LeadMeetingPrepInputResolver,
    LeadMeetingPrepEnqueueService,
    LeadMeetingPrepService,
    LeadMeetingPrepEnabledGuard,
  ],
  exports: [LeadMeetingPrepEnqueueService, LeadMeetingPrepRepository],
})
export class LeadMeetingPrepModule {}

/** Isolated export for LeadsModule — avoids circular imports. */
@Module({
  imports: [WebhooksModule],
  providers: [
    LeadMeetingPrepRepository,
    LeadMeetingPrepInputResolver,
    LeadMeetingPrepEnqueueService,
  ],
  exports: [LeadMeetingPrepEnqueueService],
})
export class LeadMeetingPrepAsyncModule {}
