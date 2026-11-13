import { Global, Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { LeadSlaSettingsModule } from '../lead-sla-settings/lead-sla-settings.module';
import { TeamSlaController, TeamSlaPublicController } from './team-sla.controller';
import { TeamSlaRepository } from './team-sla.repository';
import { TeamSlaService } from './team-sla.service';

@Global()
@Module({
  imports: [StaffAuthModule, LeadSlaSettingsModule],
  controllers: [TeamSlaController, TeamSlaPublicController],
  providers: [TeamSlaRepository, TeamSlaService],
  exports: [TeamSlaService],
})
export class TeamSlaModule {}
