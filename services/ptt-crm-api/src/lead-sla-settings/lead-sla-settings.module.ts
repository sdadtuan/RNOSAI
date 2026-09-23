import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import {
  LeadSlaSettingsController,
  LeadSlaStaffAcceptsController,
} from './lead-sla-settings.controller';
import { LeadSlaSettingsRepository } from './lead-sla-settings.repository';
import { LeadSlaSettingsService } from './lead-sla-settings.service';
import {
  LeadSlaSettingsAccessService,
  StaffLeadSlaEditGuard,
  StaffLeadSlaPublishGuard,
  StaffLeadSlaViewGuard,
} from './guards/staff-lead-sla.guard';

@Module({
  imports: [StaffAuthModule],
  controllers: [LeadSlaSettingsController, LeadSlaStaffAcceptsController],
  providers: [
    LeadSlaSettingsService,
    LeadSlaSettingsRepository,
    LeadSlaSettingsAccessService,
    StaffLeadSlaViewGuard,
    StaffLeadSlaEditGuard,
    StaffLeadSlaPublishGuard,
  ],
  exports: [
    LeadSlaSettingsService,
    LeadSlaSettingsAccessService,
    StaffLeadSlaViewGuard,
    StaffLeadSlaEditGuard,
    StaffLeadSlaPublishGuard,
  ],
})
export class LeadSlaSettingsModule {}
