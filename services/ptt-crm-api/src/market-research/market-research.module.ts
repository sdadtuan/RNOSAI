import { Module } from '@nestjs/common';
import { MarketResearchEnabledGuard } from './guards/market-research-enabled.guard';
import { MarketResearchController } from './market-research.controller';

@Module({
  controllers: [MarketResearchController],
  providers: [MarketResearchEnabledGuard],
})
export class MarketResearchModule {}
