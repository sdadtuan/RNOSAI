import { Module } from '@nestjs/common';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { LeadMeetingPrepController } from './lead-meeting-prep.controller';
import { LeadMeetingPrepEnqueueService } from './lead-meeting-prep-enqueue.service';
import { LeadMeetingPrepInputResolver } from './lead-meeting-prep-input.resolver';
import { LeadMeetingPrepRepository } from './lead-meeting-prep.repository';
import { LeadMeetingPrepService } from './lead-meeting-prep.service';

@Module({
  imports: [WebhooksModule],
  controllers: [LeadMeetingPrepController],
  providers: [
    LeadMeetingPrepRepository,
    LeadMeetingPrepInputResolver,
    LeadMeetingPrepEnqueueService,
    LeadMeetingPrepService,
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
