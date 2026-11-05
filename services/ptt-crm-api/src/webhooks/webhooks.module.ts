import { Module, forwardRef } from '@nestjs/common';
import { B2bFacebookSyncController } from '../b2b-projects/b2b-facebook-sync.controller';
import { B2bProjectsModule } from '../b2b-projects/b2b-projects.module';
import { LeadsModule } from '../leads/leads.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { WebhooksEnabledGuard } from './guards/webhooks-enabled.guard';
import { JobQueueRepository } from './job-queue.repository';
import { MetaLeadSyncService } from './meta-lead-sync.service';
import { MetaWebhookRepository } from './meta-webhook.repository';
import { MetaOpsWebhookService } from './meta-ops-webhook.service';
import { WebhookNestIngestService } from './webhook-nest-ingest.service';
import { B2bOrphanFirstAssignService } from './b2b-orphan-first-assign.service';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [B2bProjectsModule, StaffAuthModule, forwardRef(() => LeadsModule)],
  controllers: [WebhooksController, B2bFacebookSyncController],
  providers: [
    WebhooksService,
    JobQueueRepository,
    MetaWebhookRepository,
    MetaOpsWebhookService,
    MetaLeadSyncService,
    WebhookNestIngestService,
    B2bOrphanFirstAssignService,
    WebhooksEnabledGuard,
  ],
  exports: [
    WebhooksService,
    JobQueueRepository,
    MetaWebhookRepository,
    MetaOpsWebhookService,
    WebhookNestIngestService,
  ],
})
export class WebhooksModule {}
