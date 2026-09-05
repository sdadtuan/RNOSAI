import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffAmGuard } from './guards/staff-am.guard';

@Module({
  imports: [StaffAuthModule],
  providers: [StaffAmGuard],
  exports: [StaffAmGuard],
})
export class AmModule {}
