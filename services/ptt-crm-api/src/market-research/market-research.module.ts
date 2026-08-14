import { Module } from '@nestjs/common';
import { ContentMarketingModule } from '../content-marketing/content-marketing.module';
import { MarketingPlansModule } from '../marketing-plans/marketing-plans.module';
import { OpsModule } from '../ops/ops.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffClientScopeModule } from '../staff-client-scope/staff-client-scope.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { MarketResearchEnabledGuard } from './guards/market-research-enabled.guard';
import {
  StaffMarketResearchApproveGuard,
  StaffMarketResearchCreateGuard,
  StaffMarketResearchEditGuard,
  StaffMarketResearchExportGuard,
  StaffMarketResearchRunGuard,
  StaffMarketResearchViewGuard,
  StaffResearchContentWriteGuard,
  StaffResearchMktplanEditGuard,
} from './guards/staff-market-research.guard';
import { MarketResearchController } from './market-research.controller';
import { MarketResearchLlmService } from './market-research-llm.service';
import { MarketResearchRepository } from './market-research.repository';
import { MarketResearchService } from './market-research.service';

@Module({
  imports: [
    StaffAuthModule,
    StaffClientScopeModule,
    WebhooksModule,
    MarketingPlansModule,
    OpsModule,
    ContentMarketingModule,
  ],
  controllers: [MarketResearchController],
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
    StaffResearchMktplanEditGuard,
    StaffResearchContentWriteGuard,
  ],
})
export class MarketResearchModule {}
