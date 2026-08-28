import { Module } from '@nestjs/common';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { LeadMeetingPrepEnqueueService } from './lead-meeting-prep-enqueue.service';
import { LeadMeetingPrepInputResolver } from './lead-meeting-prep-input.resolver';
import { LeadMeetingPrepRepository } from './lead-meeting-prep.repository';
import { LmpSciAnalyticsService } from './lmp-sci-analytics.service';
import { LmpDiscoverAnalyticsService } from './lmp-discover-analytics.service';

/** Minimal LMP surface for modules that must not import full LeadMeetingPrepModule. */
@Module({
  imports: [WebhooksModule],
  providers: [
    LeadMeetingPrepRepository,
    LeadMeetingPrepInputResolver,
    LeadMeetingPrepEnqueueService,
    LmpSciAnalyticsService,
    LmpDiscoverAnalyticsService,
  ],
  exports: [
    LeadMeetingPrepEnqueueService,
    LeadMeetingPrepRepository,
    LmpSciAnalyticsService,
    LmpDiscoverAnalyticsService,
  ],
})
export class LeadMeetingPrepAsyncModule {}
