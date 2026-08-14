import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { MarketResearchEnabledGuard } from '../market-research/guards/market-research-enabled.guard';
import { PortalJwtGuard, PortalUser } from '../portal/portal-jwt.guard';
import { PortalJwtPayload } from '../portal/portal-jwt.util';
import { PortalResearchService } from './portal-research.service';

@Controller('api/v1/portal/research')
@UseGuards(PortalJwtGuard, MarketResearchEnabledGuard)
export class PortalResearchController {
  constructor(private readonly research: PortalResearchService) {}

  @Get('reports')
  list(@PortalUser() user: PortalJwtPayload) {
    return this.research.listReports(user);
  }

  @Get('reports/:versionId')
  detail(
    @PortalUser() user: PortalJwtPayload,
    @Param('versionId', ParseIntPipe) versionId: number,
  ) {
    return this.research.getReport(user, versionId);
  }
}
