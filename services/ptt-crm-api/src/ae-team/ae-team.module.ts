import { Module } from '@nestjs/common';
import { B2bProjectsModule } from '../b2b-projects/b2b-projects.module';
import { ConfigModule } from '../config/config.module';
import { LeadSlaSettingsModule } from '../lead-sla-settings/lead-sla-settings.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffNotificationsModule } from '../staff-notifications/staff-notifications.module';
import { AeTeamAlertWorker } from './ae-team-alert.worker';
import { AeTeamAlertsService } from './ae-team-alerts.service';
import { AeTeamController } from './ae-team.controller';
import { AeTeamRepository } from './ae-team.repository';
import { AeTeamService } from './ae-team.service';

@Module({
  imports: [ConfigModule, StaffAuthModule, LeadSlaSettingsModule, B2bProjectsModule, StaffNotificationsModule],
  controllers: [AeTeamController],
  providers: [AeTeamRepository, AeTeamService, AeTeamAlertsService, AeTeamAlertWorker],
})
export class AeTeamModule {}
