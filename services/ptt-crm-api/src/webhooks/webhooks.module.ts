import { Module } from '@nestjs/common';
import { B2bFacebookSyncController } from '../b2b-projects/b2b-facebook-sync.controller';
import { B2bProjectsModule } from '../b2b-projects/b2b-projects.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { WebhooksEnabledGuard } from './guards/webhooks-enabled.guard';
import { JobQueueRepository } from './job-queue.repository';
import { MetaLeadSyncService } from './meta-lead-sync.service';
import { MetaWebhookRepository } from './meta-webhook.repository';
import { MetaOpsWebhookService } from './meta-ops-webhook.service';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [B2bProjectsModule, StaffAuthModule],
  controllers: [WebhooksController, B2bFacebookSyncController],
  providers: [
    WebhooksService,
    JobQueueRepository,
    MetaWebhookRepository,
    MetaOpsWebhookService,
    MetaLeadSyncService,
    WebhooksEnabledGuard,
  ],
  exports: [WebhooksService, JobQueueRepository, MetaWebhookRepository, MetaOpsWebhookService],
})
export class WebhooksModule {}
