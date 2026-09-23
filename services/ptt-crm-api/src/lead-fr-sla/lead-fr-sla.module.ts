import { Module } from '@nestjs/common';
import { LeadSlaSettingsModule } from '../lead-sla-settings/lead-sla-settings.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { LeadsModule } from '../leads/leads.module';
import { LeadFrSlaController } from './lead-fr-sla.controller';
import { LeadFrSlaRepository } from './lead-fr-sla.repository';
import { LeadFrSlaService } from './lead-fr-sla.service';
import { LeadSlaDeskService } from './lead-sla-desk.service';
import { LeadSlaGdkdController } from './lead-sla-gdkd.controller';
import { LeadSlaReassignService } from './lead-sla-reassign.service';
import { LeadSlaReassignWorker } from './lead-sla-reassign.worker';

@Module({
  imports: [StaffAuthModule, LeadSlaSettingsModule, LeadsModule],
  controllers: [LeadFrSlaController, LeadSlaGdkdController],
  providers: [
    LeadFrSlaService,
    LeadFrSlaRepository,
    LeadSlaReassignService,
    LeadSlaReassignWorker,
    LeadSlaDeskService,
  ],
  exports: [LeadFrSlaService, LeadSlaReassignService, LeadSlaDeskService],
})
export class LeadFrSlaModule {}
