import { Module, forwardRef } from '@nestjs/common';
import { StaffBreakGlassModule } from '../staff-break-glass/staff-break-glass.module';
import { StaffPermissionsModule } from '../staff-permissions/staff-permissions.module';
import { StaffPermissionSetsModule } from '../staff-permission-sets/staff-permission-sets.module';
import { StaffAuthController } from './staff-auth.controller';
import { StaffAuthService } from './staff-auth.service';
import { StaffJwtGuard } from './staff-jwt.guard';
import { StaffOrInternalKeyGuard } from './staff-or-internal-key.guard';

@Module({
  imports: [
    forwardRef(() => StaffPermissionsModule),
    forwardRef(() => StaffPermissionSetsModule),
    forwardRef(() => StaffBreakGlassModule),
  ],
  controllers: [StaffAuthController],
  providers: [StaffAuthService, StaffJwtGuard, StaffOrInternalKeyGuard],
  exports: [StaffAuthService, StaffJwtGuard, StaffOrInternalKeyGuard],
})
export class StaffAuthModule {}
