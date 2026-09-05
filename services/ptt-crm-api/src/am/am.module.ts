import { Module, forwardRef } from '@nestjs/common';
import { AgencyModule } from '../agency/agency.module';
import { ConfigModule } from '../config/config.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { AmAccountsRepository, AmAccountsService } from './am-accounts.service';
import { AmAuditRepository } from './am-audit.repository';
import { AmDashboardService } from './am-dashboard.service';
import { AmPlansRepository, AmPlansService } from './am-plans.service';
import { AmSearchRepository, AmSearchService } from './am-search.service';
import { AmTasksRepository, AmTasksService } from './am-tasks.service';
import { AmController } from './am.controller';
import { StaffAmGuard } from './guards/staff-am.guard';

@Module({
  imports: [ConfigModule, StaffAuthModule, forwardRef(() => AgencyModule)],
  controllers: [AmController],
  providers: [
    StaffAmGuard,
    AmDashboardService,
    AmAuditRepository,
    AmTasksRepository,
    AmTasksService,
    AmAccountsRepository,
    AmAccountsService,
    AmPlansRepository,
    AmPlansService,
    AmSearchRepository,
    AmSearchService,
  ],
  exports: [
    StaffAmGuard,
    AmDashboardService,
    AmAuditRepository,
    AmTasksService,
    AmAccountsService,
    AmPlansService,
    AmSearchService,
  ],
})
export class AmModule {}
