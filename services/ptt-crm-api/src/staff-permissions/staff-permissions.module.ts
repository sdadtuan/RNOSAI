import { Module, forwardRef } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffPermissionsController } from './staff-permissions.controller';
import { StaffPermissionsRepository } from './staff-permissions.repository';
import { StaffJobFunctionsRepository } from './staff-job-functions.repository';
import { StaffPermissionsService } from './staff-permissions.service';
import {
  StaffPermissionsConfigureGuard,
  StaffPermissionsViewGuard,
} from './guards/staff-permissions.guard';

@Module({
  imports: [forwardRef(() => StaffAuthModule)],
  controllers: [StaffPermissionsController],
  providers: [
    StaffPermissionsRepository,
    StaffJobFunctionsRepository,
    StaffPermissionsService,
    StaffPermissionsViewGuard,
    StaffPermissionsConfigureGuard,
  ],
  exports: [StaffPermissionsService, StaffJobFunctionsRepository],
})
export class StaffPermissionsModule {}
