import { Module, forwardRef } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { LeadsContractModule } from '../leads-contract/leads-contract.module';
import { PerformanceModule } from '../performance/performance.module';
import { PortalModule } from '../portal/portal.module';
import { ServiceLifecycleModule } from '../service-lifecycle/service-lifecycle.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffClientScopeModule } from '../staff-client-scope/staff-client-scope.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { WorkflowsModule } from '../workflows/workflows.module';
import { AgencyOpsController } from './agency-ops.controller';
import { AgencySideEffectsService } from './agency-side-effects.service';
import { AgencyRepository } from './agency.repository';
import { AgencyService } from './agency.service';
import { ClientOffboardRepository } from './client-offboard.repository';
import { ClientOffboardFollowUpService } from './client-offboard-follow-up.service';
import { ClientOffboardService } from './client-offboard.service';
import { PortalClientUsersRepository } from './portal-client-users.repository';
import { PortalClientUsersService } from './portal-client-users.service';
import { PortalClientPagesRepository } from './portal-client-pages.repository';
import { PortalClientPagesService } from './portal-client-pages.service';
import { OnboardingOrchestratorRepository } from './onboarding-orchestrator.repository';
import { OnboardingOrchestratorService } from './onboarding-orchestrator.service';
import { ClientsController } from './clients.controller';
import { AgencyCampaignWriteInternalController } from './agency-campaign-write-internal.controller';
import { MetaBusinessTokenController } from './meta-business-token.controller';
import { MetaBusinessTokenRepository } from './meta-business-token.repository';
import { MetaBusinessTokenService } from './meta-business-token.service';
import { PortalMetaInsightsRepository } from './portal-meta-insights.repository';
import { PortalMetaInsightsService } from './portal-meta-insights.service';
import {
  StaffAgencyViewGuard,
  StaffFacebookAdsViewGuard,
  StaffGoogleAdsViewGuard,
  StaffZaloAdsViewGuard,
} from './guards/staff-agency-view.guard';
import { StaffAgencyConfigureGuard } from './guards/staff-agency-configure.guard';
import { StaffAgencyWriteGuard } from './guards/staff-agency-write.guard';
import { InternalKeyGuard } from '../auth/internal-key.guard';

@Module({
  imports: [
    StaffAuthModule,
    StaffClientScopeModule,
    forwardRef(() => PortalModule),
    forwardRef(() => PerformanceModule),
    EventsModule,
    WebhooksModule,
    WorkflowsModule,
    forwardRef(() => LeadsContractModule),
    forwardRef(() => ServiceLifecycleModule),
  ],
  controllers: [ClientsController, AgencyOpsController, AgencyCampaignWriteInternalController, MetaBusinessTokenController],
  providers: [
    AgencyService,
    AgencyRepository,
    AgencySideEffectsService,
    ClientOffboardRepository,
    ClientOffboardFollowUpService,
    ClientOffboardService,
    PortalClientUsersRepository,
    PortalClientUsersService,
    PortalClientPagesRepository,
    PortalClientPagesService,
    MetaBusinessTokenRepository,
    MetaBusinessTokenService,
    PortalMetaInsightsRepository,
    PortalMetaInsightsService,
    OnboardingOrchestratorRepository,
    OnboardingOrchestratorService,
    StaffAgencyViewGuard,
    StaffFacebookAdsViewGuard,
    StaffGoogleAdsViewGuard,
    StaffZaloAdsViewGuard,
    StaffAgencyWriteGuard,
    StaffAgencyConfigureGuard,
    InternalKeyGuard,
  ],
  exports: [
    AgencyService,
    AgencyRepository,
    AgencySideEffectsService,
    ClientOffboardService,
    OnboardingOrchestratorService,
    PortalClientPagesService,
    PortalClientPagesRepository,
    PortalClientUsersService,
    MetaBusinessTokenService,
    PortalMetaInsightsService,
  ],
})
export class AgencyModule {}
