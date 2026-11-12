import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AgencyRepository } from './agency/agency.repository';
import { MetaBusinessTokenRepository } from './agency/meta-business-token.repository';
import { MetaBusinessTokenService } from './agency/meta-business-token.service';
import { PortalClientPagesRepository } from './agency/portal-client-pages.repository';
import { PortalClientPagesService } from './agency/portal-client-pages.service';
import { PortalMetaInsightsPollerService } from './agency/portal-meta-insights-poller.service';
import { PortalMetaInsightsRepository } from './agency/portal-meta-insights.repository';
import { PortalMetaInsightsService } from './agency/portal-meta-insights.service';
import { ConfigModule } from './config/config.module';
import { PortalCareRepository } from './portal/portal-care.repository';
import { PortalInboxPollerService } from './portal/portal-inbox-poller.service';
import { PortalInboxSyncService } from './portal/portal-inbox-sync.service';
import { PortalMetaWebhookWorkerService } from './portal/portal-meta-webhook-worker.service';

/** Inbox + leadgen + Meta insights only — no HTTP, no AgencyModule graph. */
@Module({
  imports: [ConfigModule, ScheduleModule.forRoot()],
  providers: [
    AgencyRepository,
    MetaBusinessTokenRepository,
    MetaBusinessTokenService,
    PortalClientPagesRepository,
    PortalClientPagesService,
    PortalCareRepository,
    PortalInboxSyncService,
    PortalInboxPollerService,
    PortalMetaInsightsRepository,
    PortalMetaInsightsService,
    PortalMetaInsightsPollerService,
    PortalMetaWebhookWorkerService,
  ],
})
export class PortalWorkerModule {}
