import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { B2bAlertsController } from './b2b-alerts.controller';
import { B2bAlertsRepository } from './b2b-alerts.repository';
import { B2bAlertsService } from './b2b-alerts.service';
import { B2bLeadScopeService } from './b2b-lead-scope.service';
import { B2bIngestService } from './b2b-ingest.service';
import { B2bProjectsController } from './b2b-projects.controller';
import { B2bProjectsRepository } from './b2b-projects.repository';
import { B2bProjectsService } from './b2b-projects.service';
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
import { B2bStaffPushSender } from './b2b-staff-push.sender';

@Module({
  imports: [StaffAuthModule],
  controllers: [B2bProjectsController, B2bAlertsController],
  providers: [
    B2bProjectsService,
    B2bProjectsRepository,
    B2bLeadScopeService,
    B2bIngestService,
    B2bSlaRepository,
    B2bFirstAssignMlAdapter,
    B2bFirstAssignService,
    B2bSlaTickService,
    B2bSlaTickJob,
    B2bCallsRepository,
    B2bCallsService,
    B2bAlertsRepository,
    B2bAlertsService,
    B2bStaffPushSender,
    StaffB2bProjectsViewGuard,
    StaffB2bProjectsManageGuard,
  ],
  exports: [
    B2bProjectsService,
    B2bProjectsRepository,
    B2bLeadScopeService,
    B2bIngestService,
    B2bFirstAssignService,
    B2bSlaTickService,
    B2bCallsService,
    B2bAlertsService,
  ],
})
export class B2bProjectsModule {}
