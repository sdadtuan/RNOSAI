import { Module, forwardRef } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffPermissionsModule } from '../staff-permissions/staff-permissions.module';
import { StaffOrgController } from './staff-org.controller';
import { StaffOrgService } from './staff-org.service';
import {
  StaffOrgConfigureGuard,
  StaffOrgDepartmentsConfigureGuard,
  StaffOrgDepartmentsViewGuard,
  StaffOrgEffectiveCapsGuard,
  StaffOrgRosterViewGuard,
} from './guards/staff-org.guard';

@Module({
  imports: [forwardRef(() => StaffAuthModule), forwardRef(() => StaffPermissionsModule)],
  controllers: [StaffOrgController],
  providers: [
    StaffOrgService,
    StaffOrgRosterViewGuard,
    StaffOrgConfigureGuard,
    StaffOrgDepartmentsViewGuard,
    StaffOrgDepartmentsConfigureGuard,
    StaffOrgEffectiveCapsGuard,
  ],
  exports: [StaffOrgService],
})
export class StaffOrgModule {}
