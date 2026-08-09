import { Module, forwardRef } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { ServiceLifecycleModule } from '../service-lifecycle/service-lifecycle.module';
import { StaffOpsViewGuard } from './guards/staff-ops-view.guard';
import { OpsController } from './ops.controller';
import { OpsProfilePgRepository } from './ops-profile-pg.repository';
import { OpsRouteMapLoader } from './ops-route-map.loader';
import { OpsService } from './ops.service';

@Module({
  imports: [StaffAuthModule, forwardRef(() => ServiceLifecycleModule)],
  controllers: [OpsController],
  providers: [OpsService, OpsRouteMapLoader, OpsProfilePgRepository, StaffOpsViewGuard],
  exports: [OpsService],
})
export class OpsModule {}
