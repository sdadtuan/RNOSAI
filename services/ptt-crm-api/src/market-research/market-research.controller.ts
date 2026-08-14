import { Controller, Get, UseGuards } from '@nestjs/common';
import { MarketResearchEnabledGuard } from './guards/market-research-enabled.guard';

@Controller('api/v1/research')
@UseGuards(MarketResearchEnabledGuard)
export class MarketResearchController {
  @Get('health')
  health() {
    return { ok: true, enabled: true };
  }
}
