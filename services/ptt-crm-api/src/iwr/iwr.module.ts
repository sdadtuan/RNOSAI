import { Module } from '@nestjs/common';
import { CsdModule } from '../csd/csd.module';
import { ConfigModule } from '../config/config.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffIwrGuard } from './guards/staff-iwr.guard';
import { IwrDistributionRepository } from './iwr-distribution.repository';
import { IwrDistributionService } from './iwr-distribution.service';
import { IwrInboxController } from './iwr-inbox.controller';
import { IwrInboxService } from './iwr-inbox.service';
import { IwrItemsService } from './iwr-items.service';
import { IwrListsController } from './iwr-lists.controller';
import { IwrListsRepository } from './iwr-lists.repository';
import { IwrListsService } from './iwr-lists.service';
import { IwrPolicyRepository } from './iwr-policy.repository';
import { IwrPolicyService } from './iwr-policy.service';
import { IwrOrgRepository, IwrReportsRepository } from './iwr-reports.repository';
import { IwrReportsController } from './iwr-reports.controller';
import { IwrReportsService } from './iwr-reports.service';
import { IwrRisksController } from './iwr-risks.controller';
import { IwrRisksRepository } from './iwr-distribution.repository';
import { IwrRisksService } from './iwr-risks.service';
import { IwrSuggestService } from './iwr-suggest.service';
import { IwrTemplatesController } from './iwr-templates.controller';
import { IwrDashboardsController } from './iwr-dashboards.controller';
import { IwrDashboardsService } from './iwr-dashboards.service';
import {
  IwrDashSnapshotsRepository,
  IwrDelegationsRepository,
  IwrScheduleRepository,
} from './iwr-w4.repository';
import { IwrDelegationsService, IwrEmailService, IwrFilesService } from './iwr-w4.service';
import { IwrScheduleWorkerService, IwrSchedulesService } from './iwr-schedule-worker.service';
import { IwrSchedulesController } from './iwr-schedules.controller';
import { IwrLeaveAdapter } from './iwr-leave.adapter';
import { IwrBuilderController } from './iwr-builder.controller';
import { IwrBuilderService } from './iwr-builder.service';
import { IwrApprovalsController } from './iwr-approvals.controller';
import { IwrApprovalsService } from './iwr-approvals.service';
import { IwrWebhooksController } from './iwr-webhooks.controller';
import { IwrWebhooksService } from './iwr-webhooks.service';
import { IwrW5Repository } from './iwr-w5.repository';

@Module({
  imports: [ConfigModule, StaffAuthModule, CsdModule],
  controllers: [
    IwrInboxController,
    IwrReportsController,
    IwrTemplatesController,
    IwrListsController,
    IwrRisksController,
    IwrDashboardsController,
    IwrSchedulesController,
    IwrBuilderController,
    IwrApprovalsController,
    IwrWebhooksController,
  ],
  providers: [
    StaffIwrGuard,
    IwrOrgRepository,
    IwrReportsRepository,
    IwrReportsService,
    IwrInboxService,
    IwrItemsService,
    IwrSuggestService,
    IwrPolicyRepository,
    IwrPolicyService,
    IwrListsRepository,
    IwrListsService,
    IwrDistributionRepository,
    IwrDistributionService,
    IwrRisksRepository,
    IwrRisksService,
    IwrDashSnapshotsRepository,
    IwrScheduleRepository,
    IwrDelegationsRepository,
    IwrDashboardsService,
    IwrSchedulesService,
    IwrScheduleWorkerService,
    IwrLeaveAdapter,
    IwrFilesService,
    IwrEmailService,
    IwrDelegationsService,
    IwrW5Repository,
    IwrBuilderService,
    IwrApprovalsService,
    IwrWebhooksService,
  ],
  exports: [IwrReportsService, IwrInboxService, IwrDashboardsService],
})
export class IwrModule {}
