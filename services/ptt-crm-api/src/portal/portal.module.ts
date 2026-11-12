import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AgencyModule } from '../agency/agency.module';
import { PortalAuthController } from './portal-auth.controller';
import { PortalAuthService } from './portal-auth.service';
import { CampaignMilestoneNotifyService } from '../agency/campaign-milestone-notify.service';
import { PortalCreativeNotifyService } from './portal-creative-notify.service';
import { PortalNotificationController } from './portal-notification.controller';
import { PortalNotificationRepository } from './portal-notification.repository';
import { PortalNotificationService } from './portal-notification.service';
import { PortalNotifyWebhookService } from './portal-notify-webhook.service';
import { PortalPasswordResetNotifyService } from './portal-password-reset-notify.service';
import { PortalCredentialsNotifyService } from './portal-credentials-notify.service';
import { PortalPasswordResetRepository } from './portal-password-reset.repository';
import { PortalPasswordResetService } from './portal-password-reset.service';
import { PortalMobileController } from './portal-mobile.controller';
import { PortalMobileService } from './portal-mobile.service';
import { PortalNativeDeviceRepository } from './portal-native-device.repository';
import { PortalNativePushSenderService } from './portal-native-push-sender.service';
import { PortalPushController } from './portal-push.controller';
import { PortalPushRepository } from './portal-push.repository';
import { PortalPushSenderService } from './portal-push-sender.service';
import { PortalPushService } from './portal-push.service';
import { PortalJwtGuard } from './portal-jwt.guard';
import { PortalSettingsController } from './portal-settings.controller';
import { PortalSettingsRepository } from './portal-settings.repository';
import { PortalSettingsService } from './portal-settings.service';
import { PortalCrmController } from './portal-crm.controller';
import { PortalMetaInsightsController } from './portal-meta-insights.controller';
import { PortalProductMediaController } from './portal-product-media.controller';
import { PortalCareRepository } from './portal-care.repository';
import { PortalCareService } from './portal-care.service';
import { PortalInboxPollerService } from './portal-inbox-poller.service';
import { PortalInboxSyncService } from './portal-inbox-sync.service';
import { PortalMetaWebhookController } from './portal-meta-webhook.controller';
import { PortalMetaWebhookService } from './portal-meta-webhook.service';
import { PortalPosController, PortalPosWebhookController } from './pos/portal-pos.controller';
import { PortalPosService } from './pos/portal-pos.service';
import { PortalPosRepository } from './pos/portal-pos.repository';

@Module({
  imports: [forwardRef(() => AgencyModule), ScheduleModule.forRoot()],
  controllers: [
    PortalAuthController,
    PortalSettingsController,
    PortalNotificationController,
    PortalPushController,
    PortalMobileController,
    PortalCrmController,
    PortalMetaInsightsController,
    PortalProductMediaController,
    PortalMetaWebhookController,
    PortalPosController,
    PortalPosWebhookController,
  ],
  providers: [
    PortalAuthService,
    PortalJwtGuard,
    PortalSettingsRepository,
    PortalSettingsService,
    PortalNotifyWebhookService,
    PortalNotificationRepository,
    PortalNotificationService,
    PortalCreativeNotifyService,
    CampaignMilestoneNotifyService,
    PortalPasswordResetRepository,
    PortalPasswordResetNotifyService,
    PortalCredentialsNotifyService,
    PortalPasswordResetService,
    PortalPushRepository,
    PortalPushService,
    PortalPushSenderService,
    PortalNativeDeviceRepository,
    PortalNativePushSenderService,
    PortalMobileService,
    PortalCareRepository,
    PortalInboxSyncService,
    PortalCareService,
    PortalInboxPollerService,
    PortalMetaWebhookService,
    PortalPosRepository,
    PortalPosService,
  ],
  exports: [
    PortalAuthService,
    PortalJwtGuard,
    PortalSettingsService,
    PortalCreativeNotifyService,
    PortalNotificationService,
    PortalNotifyWebhookService,
    PortalCredentialsNotifyService,
    CampaignMilestoneNotifyService,
    PortalPasswordResetService,
    PortalPushSenderService,
    PortalNativePushSenderService,
    PortalMobileService,
    forwardRef(() => AgencyModule),
  ],
})
export class PortalModule {}
