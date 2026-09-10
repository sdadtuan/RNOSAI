import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import {
  StaffContentMarketingViewGuard,
  StaffContentMarketingWriteGuard,
} from '../content-marketing/guards/staff-content-marketing.guard';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import type { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { ContentOsPortfolioService } from './content-os-portfolio.service';

function actorEmail(req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }): string {
  if (req.staffAuthVia === 'internal') return 'internal';
  return req.staffUser?.email ?? 'unknown';
}

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

  @Get('requests')
  listRequests(@Req() req: Request) {
    return this.portfolio.listRequests({
      staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0),
    });
  }

  @Post('requests')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  createRequest(@Body() body: Record<string, unknown>, @Req() req: Request) {
    return this.portfolio.createRequest({
      lifecycleId: Number(body.lifecycle_id),
      actor: actorEmail(req),
      body,
    });
  }

  @Post('requests/:id/convert')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  convertRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.portfolio.convertRequest({
      requestId: id,
      actor: actorEmail(req),
      body: body ?? {},
    });
  }
}
