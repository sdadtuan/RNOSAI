import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffPermissionsController } from './staff-permissions.controller';
import { StaffPermissionsRepository } from './staff-permissions.repository';
import { StaffPermissionsService } from './staff-permissions.service';
import {
  StaffPermissionsConfigureGuard,
  StaffPermissionsViewGuard,
} from './guards/staff-permissions.guard';

@Module({
  imports: [StaffAuthModule],
  controllers: [StaffPermissionsController],
  providers: [
    StaffPermissionsRepository,
    StaffPermissionsService,
    StaffPermissionsViewGuard,
    StaffPermissionsConfigureGuard,
  ],
  exports: [StaffPermissionsService],
})
export class StaffPermissionsModule {}
