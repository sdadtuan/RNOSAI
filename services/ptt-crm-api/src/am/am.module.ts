import { Module, forwardRef } from '@nestjs/common';
import { AgencyModule } from '../agency/agency.module';
import { ConfigModule } from '../config/config.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { AmAccountsRepository, AmAccountsService } from './am-accounts.service';
import { AmAuditRepository } from './am-audit.repository';
import { AmDashboardService } from './am-dashboard.service';
import { AmHealthRepository, AmHealthService } from './am-health.service';
import { AmPlansRepository, AmPlansService } from './am-plans.service';
import { AmSearchRepository, AmSearchService } from './am-search.service';
import { AmNotificationsRepository, AmNotificationsService } from './am-notifications.service';
import { AmSettingsRepository, AmSettingsService } from './am-settings.service';
import { AmTasksRepository, AmTasksService } from './am-tasks.service';
import { AmViewsRepository, AmViewsService } from './am-views.service';
import { AmOnboardingRepository, AmOnboardingService } from './am-onboarding.service';
import { AmContractsRepository, AmContractsService } from './am-contracts.service';
import { AmRenewalsRepository, AmRenewalsService } from './am-renewals.service';
import { AmRenewalWorker } from './am-renewal.worker';
import { AmInteractionsRepository, AmInteractionsService } from './am-interactions.service';
import { AmRisksRepository, AmRisksService } from './am-risks.service';
import { AmOpportunitiesRepository, AmOpportunitiesService } from './am-opportunities.service';
import { AmReportsRepository, AmReportsService } from './am-reports.service';
import { AmFinanceRepository, AmFinanceService } from './am-finance.service';
import { AmFeedbackRepository, AmFeedbackService } from './am-feedback.service';
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
    AmHealthRepository,
    AmHealthService,
    AmSettingsRepository,
    AmSettingsService,
    AmNotificationsRepository,
    AmNotificationsService,
    AmViewsRepository,
    AmViewsService,
    AmOnboardingRepository,
    AmOnboardingService,
    AmContractsRepository,
    AmContractsService,
    AmRenewalsRepository,
    AmRenewalsService,
    AmRenewalWorker,
    AmInteractionsRepository,
    AmInteractionsService,
    AmRisksRepository,
    AmRisksService,
    AmOpportunitiesRepository,
    AmOpportunitiesService,
    AmReportsRepository,
    AmReportsService,
    AmFinanceRepository,
    AmFinanceService,
    AmFeedbackRepository,
    AmFeedbackService,
  ],
  exports: [
    StaffAmGuard,
    AmDashboardService,
    AmAuditRepository,
    AmTasksService,
    AmAccountsService,
    AmPlansService,
    AmSearchService,
    AmHealthService,
    AmSettingsService,
    AmNotificationsService,
    AmViewsService,
    AmOnboardingService,
    AmContractsService,
    AmRenewalsService,
    AmRenewalWorker,
    AmInteractionsService,
    AmRisksService,
    AmOpportunitiesService,
    AmReportsService,
    AmFinanceService,
    AmFeedbackService,
  ],
})
export class AmModule {}
