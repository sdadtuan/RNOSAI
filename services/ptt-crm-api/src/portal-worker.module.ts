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
import { PortalCareNotifyService } from './portal/portal-care-notify.service';
import { PortalCareRepository } from './portal/portal-care.repository';
import { PortalCareRebalanceService } from './portal/portal-care-rebalance.service';
import { PortalInboxPollerService } from './portal/portal-inbox-poller.service';
import { PortalInboxSyncService } from './portal/portal-inbox-sync.service';
import { PortalMetaWebhookWorkerService } from './portal/portal-meta-webhook-worker.service';
import { PortalNativeDeviceRepository } from './portal/portal-native-device.repository';
import { PortalNativePushSenderService } from './portal/portal-native-push-sender.service';
import { PortalNotificationRepository } from './portal/portal-notification.repository';
import { PortalNotificationService } from './portal/portal-notification.service';
import { PortalNotifyWebhookService } from './portal/portal-notify-webhook.service';
import { PortalPushRepository } from './portal/portal-push.repository';
import { PortalPushSenderService } from './portal/portal-push-sender.service';

/** Inbox + leadgen + Meta insights only — no HTTP, no AgencyModule graph.
 *  Notification providers are included so care assignment and inbound-message
 *  emits from this process still persist and (when configured) send web push.
 */
@Module({
  imports: [ConfigModule, ScheduleModule.forRoot()],
  providers: [
    AgencyRepository,
    MetaBusinessTokenRepository,
    MetaBusinessTokenService,
    PortalClientPagesRepository,
    PortalClientPagesService,
    PortalCareRepository,
    PortalNotificationRepository,
    PortalNotifyWebhookService,
    PortalPushRepository,
    PortalNativeDeviceRepository,
    PortalNativePushSenderService,
    PortalPushSenderService,
    PortalNotificationService,
    PortalCareNotifyService,
    PortalCareRebalanceService,
    PortalInboxSyncService,
    PortalInboxPollerService,
    PortalMetaInsightsRepository,
    PortalMetaInsightsService,
    PortalMetaInsightsPollerService,
    PortalMetaWebhookWorkerService,
  ],
})
export class PortalWorkerModule {}
