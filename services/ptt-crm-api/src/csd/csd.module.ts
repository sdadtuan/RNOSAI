import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { CsdAiController } from './csd-ai.controller';
import { CsdAiRepository } from './csd-ai.repository';
import { CsdAiService } from './csd-ai.service';
import { CsdAuditRepository } from './csd-audit.repository';
import { CsdChatAccountsController } from './csd-chat-accounts.controller';
import { CsdChatAccountsRepository } from './csd-chat-accounts.repository';
import { CsdChatAccountsService } from './csd-chat-accounts.service';
import { CsdChatFriendsController } from './csd-chat-friends.controller';
import { CsdChatFriendsRepository } from './csd-chat-friends.repository';
import { CsdChatFriendsService } from './csd-chat-friends.service';
import { CsdChatController } from './csd-chat.controller';
import { CsdChatFilesController } from './csd-chat-files.controller';
import { CsdChatFilesService } from './csd-chat-files.service';
import { CsdChatRepository } from './csd-chat.repository';
import { CsdChatService } from './csd-chat.service';
import { CsdDashboardController } from './csd-dashboard.controller';
import { CsdDashboardService } from './csd-dashboard.service';
import { CsdEmailController } from './csd-email.controller';
import { CsdEmailRepository } from './csd-email.repository';
import { CsdEmailService } from './csd-email.service';
import { CsdEmailSyncWorker } from './csd-email-sync.worker';
import { CsdNotificationsController } from './csd-notifications.controller';
import { CsdNotificationsRepository } from './csd-notifications.repository';
import { CsdNotificationsService } from './csd-notifications.service';
import { CsdReportScheduleWorkerService } from './csd-report-schedule-worker.service';
import { CsdReportsController } from './csd-reports.controller';
import { CsdReportsRepository } from './csd-reports.repository';
import { CsdReportsService } from './csd-reports.service';
import { CsdSlaWorkerService } from './csd-sla-worker.service';
import { CsdTicketsController } from './csd-tickets.controller';
import { CsdTicketsRepository } from './csd-tickets.repository';
import { CsdTicketsService } from './csd-tickets.service';
import { StaffCsdGuard } from './guards/staff-csd.guard';

@Module({
  imports: [ConfigModule, StaffAuthModule],
  controllers: [
    CsdTicketsController,
    CsdChatController,
    CsdChatAccountsController,
    CsdChatFriendsController,
    CsdChatFilesController,
    CsdNotificationsController,
    CsdEmailController,
    CsdReportsController,
    CsdAiController,
    CsdDashboardController,
  ],
  providers: [
    StaffCsdGuard,
    CsdAuditRepository,
    CsdTicketsRepository,
    CsdTicketsService,
    CsdSlaWorkerService,
    CsdChatRepository,
    CsdChatAccountsRepository,
    CsdChatAccountsService,
    CsdChatFriendsRepository,
    CsdChatFriendsService,
    CsdChatFilesService,
    CsdChatService,
    CsdNotificationsRepository,
    CsdNotificationsService,
    CsdEmailRepository,
    CsdEmailService,
    CsdEmailSyncWorker,
    CsdReportsRepository,
    CsdReportsService,
    CsdReportScheduleWorkerService,
    CsdAiRepository,
    CsdAiService,
    CsdDashboardService,
  ],
  exports: [
    StaffCsdGuard,
    CsdTicketsService,
    CsdChatService,
    CsdEmailService,
    CsdReportsService,
    CsdAiService,
    CsdDashboardService,
  ],
})
export class CsdModule {}
