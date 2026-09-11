import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import {
  StaffContentMarketingApproveGuard,
  StaffContentMarketingGenerateGuard,
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
  commandCenter(@Req() req: Request, @Query('lifecycle') lifecycle?: string) {
    const hint = Number(lifecycle);
    return this.portfolio.getCommandCenter({
      staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0),
      lifecycleHint: Number.isInteger(hint) && hint > 0 ? hint : undefined,
    });
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

  @Get('items/:itemId/ai-traces')
  @UseGuards(StaffContentMarketingGenerateGuard)
  listAiTraces(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Req() req: Request,
    @Query('lifecycle') lifecycle?: string,
  ) {
    const hint = Number(lifecycle);
    return this.portfolio.listAiTraces({
      staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0),
      itemId,
      lifecycleHint: Number.isInteger(hint) && hint > 0 ? hint : undefined,
    });
  }

  @Get('items/:itemId')
  getPortfolioItem(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Req() req: Request,
    @Query('lifecycle') lifecycle?: string,
  ) {
    const hint = Number(lifecycle);
    return this.portfolio.getPortfolioItem({
      staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0),
      itemId,
      lifecycleHint: Number.isInteger(hint) && hint > 0 ? hint : undefined,
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
      staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0),
      lifecycleId: Number(body.lifecycle_id),
      actor: actorEmail(req),
      body,
    });
  }

  @Get('insights')
  listInsights(@Req() req: Request, @Query('lifecycle') lifecycle?: string) {
    const hint = Number(lifecycle);
    return this.portfolio.listInsights({
      staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0),
      lifecycleHint: Number.isInteger(hint) && hint > 0 ? hint : undefined,
    });
  }

  @Post('insights/:id/approve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingApproveGuard)
  approveInsight(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.portfolio.approveInsight({
      staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0),
      insightId: id,
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
      staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0),
      requestId: id,
      actor: actorEmail(req),
      body: body ?? {},
    });
  }
}
