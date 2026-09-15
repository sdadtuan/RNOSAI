import { Module } from '@nestjs/common';
import { ContentMarketingModule } from '../content-marketing/content-marketing.module';
import { CrmConfigModule } from '../crm-config/crm-config.module';
import {
  StaffCrmConfigConfigureGuard,
  StaffCrmConfigViewGuard,
} from '../crm-config/guards/staff-crm-config.guard';
import { LeadsModule } from '../leads/leads.module';
import { MarketingPlansModule } from '../marketing-plans/marketing-plans.module';
import { OpsModule } from '../ops/ops.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffClientScopeModule } from '../staff-client-scope/staff-client-scope.module';
import { VnAdminGeoModule } from '../vn-admin-geo/vn-admin-geo.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { MarketResearchEnabledGuard } from './guards/market-research-enabled.guard';
import {
  StaffMarketResearchApproveGuard,
  StaffMarketResearchConfigureGuard,
  StaffMarketResearchCreateGuard,
  StaffMarketResearchEditGuard,
  StaffMarketResearchExportGuard,
  StaffMarketResearchRunGuard,
  StaffMarketResearchViewGuard,
  StaffMarketResearchWhatIfGuard,
  StaffResearchContentWriteGuard,
  StaffResearchMktplanEditGuard,
} from './guards/staff-market-research.guard';
import { MarketResearchController } from './market-research.controller';
import { MarketResearchLlmService } from './market-research-llm.service';
import { MarketResearchRepository } from './market-research.repository';
import { MarketResearchService } from './market-research.service';
import {
  ResearchAiModelsCredentialsController,
  ResearchAiProvidersController,
} from './raw-lead-harvest/ai-providers.controller';
import { ResearchAiProvidersRepository } from './raw-lead-harvest/ai-providers.repository';
import { ResearchAiProvidersService } from './raw-lead-harvest/ai-providers.service';
import { HarvestWorkerService } from './raw-lead-harvest/harvest-worker.service';
import { IntentHarvestWorker } from './raw-lead-harvest/intent/intent-harvest.worker';
import { RawLeadHarvestController } from './raw-lead-harvest/raw-lead-harvest.controller';
import { RawLeadHarvestRepository } from './raw-lead-harvest/raw-lead-harvest.repository';
import { RawLeadHarvestService } from './raw-lead-harvest/raw-lead-harvest.service';

@Module({
  imports: [
    StaffAuthModule,
    StaffClientScopeModule,
    WebhooksModule,
    MarketingPlansModule,
    OpsModule,
    ContentMarketingModule,
    CrmConfigModule,
    VnAdminGeoModule,
    LeadsModule,
  ],
  controllers: [
    MarketResearchController,
    ResearchAiProvidersController,
    ResearchAiModelsCredentialsController,
    RawLeadHarvestController,
  ],
  providers: [
    MarketResearchEnabledGuard,
    MarketResearchRepository,
    MarketResearchLlmService,
    MarketResearchService,
    StaffMarketResearchViewGuard,
    StaffMarketResearchCreateGuard,
    StaffMarketResearchEditGuard,
    StaffMarketResearchApproveGuard,
    StaffMarketResearchRunGuard,
    StaffMarketResearchExportGuard,
    StaffMarketResearchConfigureGuard,
    StaffMarketResearchWhatIfGuard,
    StaffResearchMktplanEditGuard,
    StaffResearchContentWriteGuard,
    StaffCrmConfigViewGuard,
    StaffCrmConfigConfigureGuard,
    ResearchAiProvidersRepository,
    ResearchAiProvidersService,
    RawLeadHarvestRepository,
    HarvestWorkerService,
    IntentHarvestWorker,
    RawLeadHarvestService,
  ],
  exports: [ResearchAiProvidersService, ResearchAiProvidersRepository, RawLeadHarvestService],
})
export class MarketResearchModule {}
