import { Module } from '@nestjs/common';
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
} from './guards/staff-market-research.guard';
import { MarketResearchController } from './market-research.controller';
import { MarketResearchLlmService } from './market-research-llm.service';
import { MarketResearchRepository } from './market-research.repository';
import { MarketResearchService } from './market-research.service';

@Module({
  imports: [StaffAuthModule, StaffClientScopeModule, WebhooksModule],
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
  ],
})
export class MarketResearchModule {}
