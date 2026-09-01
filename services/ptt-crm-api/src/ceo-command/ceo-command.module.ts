import { Module, forwardRef } from '@nestjs/common';
import { AiIntelligenceModule } from '../ai-intelligence/ai-intelligence.module';
import { ConfigModule } from '../config/config.module';
import { CrmLeadsLegacyModule } from '../crm-leads-legacy/crm-leads-legacy.module';
import { CrmStaffModule } from '../crm-staff/crm-staff.module';
import { CrmStaffPgRepository } from '../crm-staff/crm-staff-pg.repository';
import { LeadsContractModule } from '../leads-contract/leads-contract.module';
import { LeadsModule } from '../leads/leads.module';
import { OpsModule } from '../ops/ops.module';
import { OwnerWeeklyModule } from '../owner-weekly/owner-weekly.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffNotificationsModule } from '../staff-notifications/staff-notifications.module';
import { CeoCommandActionsRepository } from './ceo-command-actions.repository';
import { CeoCommandActionsService } from './ceo-command-actions.service';
import { CeoCommandBriefingService } from './ceo-command-briefing.service';
import { CeoCommandController } from './ceo-command.controller';
import { CeoCommandLearnRepository } from './ceo-command-learn.repository';
import { CeoCommandLearnService } from './ceo-command-learn.service';
import { CeoCommandLibraryService } from './ceo-command-library.service';
import { CeoCommandLlmService } from './ceo-command-llm.service';
import { CeoCommandNlService } from './ceo-command-nl.service';
import { CeoCommandRateService } from './ceo-command-rate.service';
import { CeoCommandService } from './ceo-command.service';
import { CeoCommandTurnsRepository } from './ceo-command-turns.repository';
import { CeoTowerRepository } from './ceo-tower.repository';
import { CeoTowerSensorService } from './ceo-tower-sensor.service';
import {
  StaffCeoCommandJwtOnlyGuard,
  StaffCeoCommandViewGuard,
} from './guards/staff-ceo-command.guard';

@Module({
  imports: [
    ConfigModule,
    StaffAuthModule,
    StaffNotificationsModule,
    CrmStaffModule,
    CrmLeadsLegacyModule,
    forwardRef(() => LeadsModule),
    LeadsContractModule,
    forwardRef(() => OpsModule),
    forwardRef(() => AiIntelligenceModule),
    OwnerWeeklyModule,
  ],
  controllers: [CeoCommandController],
  providers: [
    CeoCommandService,
    CeoCommandBriefingService,
    CeoCommandNlService,
    CeoCommandActionsService,
    CeoCommandActionsRepository,
    CeoCommandTurnsRepository,
    CeoCommandRateService,
    CeoCommandLlmService,
    CeoCommandLibraryService,
    CeoCommandLearnRepository,
    CeoCommandLearnService,
    CeoTowerRepository,
    CeoTowerSensorService,
    CrmStaffPgRepository,
    StaffCeoCommandViewGuard,
    StaffCeoCommandJwtOnlyGuard,
  ],
  exports: [CeoCommandService, CeoTowerSensorService],
})
export class CeoCommandModule {}
