import { Module, forwardRef } from '@nestjs/common';
import { StaffPermissionsModule } from '../staff-permissions/staff-permissions.module';
import { StaffAuthController } from './staff-auth.controller';
import { StaffAuthService } from './staff-auth.service';
import { StaffJwtGuard } from './staff-jwt.guard';
import { StaffOrInternalKeyGuard } from './staff-or-internal-key.guard';

@Module({
  imports: [forwardRef(() => StaffPermissionsModule)],
  controllers: [StaffAuthController],
  providers: [StaffAuthService, StaffJwtGuard, StaffOrInternalKeyGuard],
  exports: [StaffAuthService, StaffJwtGuard, StaffOrInternalKeyGuard],
})
export class StaffAuthModule {}
