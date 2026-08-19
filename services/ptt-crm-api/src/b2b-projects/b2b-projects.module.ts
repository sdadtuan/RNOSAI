import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { B2bAlertStreamService } from './b2b-alert-stream.service';
import { B2bAlertsController } from './b2b-alerts.controller';
import { B2bAlertsRepository } from './b2b-alerts.repository';
import { B2bAlertsService } from './b2b-alerts.service';
import { B2bLeadScopeService } from './b2b-lead-scope.service';
import { B2bLeadAiFilterService } from './b2b-lead-ai-filter.service';
import { B2bIngestService } from './b2b-ingest.service';
import { B2bProjectsController } from './b2b-projects.controller';
import { B2bProjectsRepository } from './b2b-projects.repository';
import { B2bProjectsService } from './b2b-projects.service';
import { B2bStaffPushController } from './b2b-staff-push.controller';
import { B2bStaffPushRepository } from './b2b-staff-push.repository';
import { B2bUnmatchedController } from './b2b-unmatched.controller';
import { B2bUnmatchedService } from './b2b-unmatched.service';
import {
  StaffB2bProjectsManageGuard,
  StaffB2bProjectsViewGuard,
} from './guards/staff-b2b-projects.guard';
import {
  B2bFirstAssignMlAdapter,
  B2bFirstAssignService,
} from './b2b-first-assign.service';
import { B2bSlaRepository } from './b2b-sla.repository';
import { B2bSlaTickService } from './b2b-sla-tick.service';
import { B2bSlaTickJob } from './b2b-sla-tick.job';
import { B2bCallsRepository } from './b2b-calls.repository';
import { B2bCallsService } from './b2b-calls.service';
import { B2bCallsController } from './b2b-calls.controller';
import { B2bStaffPushSender } from './b2b-staff-push.sender';
import { B2bSpeedRepository } from './b2b-speed.repository';
import { B2bSpeedService } from './b2b-speed.service';
import { B2bSpeedController } from './b2b-speed.controller';
import { B2bStringeeTokenService } from './b2b-stringee-token.service';

@Module({
  imports: [StaffAuthModule],
  controllers: [
    B2bProjectsController,
    B2bAlertsController,
    B2bStaffPushController,
    B2bUnmatchedController,
    B2bCallsController,
    B2bSpeedController,
  ],
  providers: [
    B2bProjectsService,
    B2bProjectsRepository,
    B2bLeadScopeService,
    B2bLeadAiFilterService,
    B2bIngestService,
    B2bSlaRepository,
    B2bFirstAssignMlAdapter,
    B2bFirstAssignService,
    B2bSlaTickService,
    B2bSlaTickJob,
    B2bCallsRepository,
    B2bCallsService,
    B2bStringeeTokenService,
    B2bSpeedRepository,
    B2bSpeedService,
    B2bAlertsRepository,
    B2bAlertsService,
    B2bAlertStreamService,
    B2bStaffPushRepository,
    B2bStaffPushSender,
    B2bUnmatchedService,
    StaffB2bProjectsViewGuard,
    StaffB2bProjectsManageGuard,
  ],
  exports: [
    B2bProjectsService,
    B2bProjectsRepository,
    B2bLeadScopeService,
    B2bLeadAiFilterService,
    B2bIngestService,
    B2bFirstAssignService,
    B2bSlaTickService,
    B2bCallsService,
    B2bStringeeTokenService,
    B2bAlertsService,
  ],
})
export class B2bProjectsModule {}
