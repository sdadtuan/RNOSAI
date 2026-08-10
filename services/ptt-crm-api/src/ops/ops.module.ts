import { Module, forwardRef } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { ServiceLifecycleModule } from '../service-lifecycle/service-lifecycle.module';
import { StaffOpsViewGuard } from './guards/staff-ops-view.guard';
import { StaffOpsWriteGuard } from './guards/staff-ops-write.guard';
import { OpsController } from './ops.controller';
import { OpsKpiPgRepository } from './ops-kpi-pg.repository';
import { OpsProfilePgRepository } from './ops-profile-pg.repository';
import { OpsRouteMapLoader } from './ops-route-map.loader';
import { OpsService } from './ops.service';
import { OpsWeeklyPgRepository } from './ops-weekly-pg.repository';

@Module({
  imports: [StaffAuthModule, forwardRef(() => ServiceLifecycleModule)],
  controllers: [OpsController],
  providers: [
    OpsService,
    OpsRouteMapLoader,
    OpsProfilePgRepository,
    OpsWeeklyPgRepository,
    OpsKpiPgRepository,
    StaffOpsViewGuard,
    StaffOpsWriteGuard,
  ],
  exports: [OpsService, OpsRouteMapLoader, OpsProfilePgRepository],
})
export class OpsModule {}
