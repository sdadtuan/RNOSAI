import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffContentMarketingViewGuard } from '../content-marketing/guards/staff-content-marketing.guard';
import { ContentOsPortfolioService } from './content-os-portfolio.service';

@Controller('api/crm/content-os/portfolio')
@UseGuards(StaffOrInternalKeyGuard, StaffContentMarketingViewGuard)
export class ContentOsPortfolioController {
  constructor(private readonly portfolio: ContentOsPortfolioService) {}

  @Get('command-center')
  commandCenter(@Req() req: Request) {
    return this.portfolio.getCommandCenter({ staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0) });
  }

  @Get('approvals')
  approvals(@Req() req: Request) {
    return this.portfolio.listApprovals({ staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0) });
  }

  @Get('publications')
  publications(@Req() req: Request, @Query('from') from?: string, @Query('to') to?: string) {
    return this.portfolio.listPublications({
      staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0),
      from,
      to,
    });
  }
}
