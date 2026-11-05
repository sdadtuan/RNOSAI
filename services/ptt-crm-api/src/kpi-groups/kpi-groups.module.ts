import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { KpiGroupAuditRepository } from './kpi-group-audit.repository';
import {
  StaffKpiGroupsConfigureGuard,
  StaffKpiGroupsManageGuard,
  StaffKpiGroupsViewGuard,
} from './guards/staff-kpi-groups.guard';
import { KpiGroupsController } from './kpi-groups.controller';
import { KpiGroupsRepository } from './kpi-groups.repository';
import { KpiGroupsService } from './kpi-groups.service';

@Module({
  imports: [StaffAuthModule],
  controllers: [KpiGroupsController],
  providers: [
    KpiGroupsService,
    KpiGroupsRepository,
    KpiGroupAuditRepository,
    StaffKpiGroupsViewGuard,
    StaffKpiGroupsManageGuard,
    StaffKpiGroupsConfigureGuard,
  ],
  exports: [KpiGroupsService],
})
export class KpiGroupsModule {}
