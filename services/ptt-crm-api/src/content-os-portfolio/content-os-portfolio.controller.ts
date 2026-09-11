import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
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

  @Post('approvals/batch')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingApproveGuard)
  batchApprove(@Body() body: Record<string, unknown>, @Req() req: Request) {
    return this.portfolio.batchApprove({
      staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0),
      actor: actorEmail(req),
      item_ids: body.item_ids,
      step: body.step != null ? String(body.step) : undefined,
    });
  }

  @Post('approvals/:packageId/delegate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingApproveGuard)
  delegateApproval(
    @Param('packageId', ParseIntPipe) packageId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.portfolio.delegateApproval({
      staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0),
      actor: actorEmail(req),
      packageId,
      delegate_until: body.delegate_until,
      delegate_to: body.delegate_to != null ? String(body.delegate_to) : undefined,
    });
  }

  @Get('publications')
  publications(@Req() req: Request, @Query('from') from?: string, @Query('to') to?: string) {
    return this.portfolio.listPublications({
      staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0),
      from,
      to,
    });
  }

  @Get('channel-health')
  channelHealth(@Req() req: Request) {
    return this.portfolio.getChannelHealth({
      staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0),
    });
  }

  @Get('dam')
  listDamAssets(@Req() req: Request, @Query('collection') collection?: string) {
    return this.portfolio.listDamAssets({
      staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0),
      collection,
    });
  }

  @Get('audit/export')
  @UseGuards(StaffContentMarketingWriteGuard)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="cmkt-audit-export.csv"')
  exportAuditCsv(@Req() req: Request) {
    return this.portfolio.exportAuditCsv({
      staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0),
      actor: actorEmail(req),
    });
  }

  @Get('settings')
  getSettings(@Req() req: Request) {
    return this.portfolio.getSettings({
      staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0),
    });
  }

  @Patch('settings')
  @UseGuards(StaffContentMarketingWriteGuard)
  patchSettings(@Body() body: Record<string, unknown>, @Req() req: Request) {
    return this.portfolio.patchSettings({
      staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0),
      actor: actorEmail(req),
      body: body ?? {},
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

  @Get('sla-events')
  listSlaEvents(
    @Req() req: Request,
    @Query('item_id') itemId?: string,
    @Query('am_staff_id') amStaffId?: string,
  ) {
    const item = Number(itemId);
    const am = Number(amStaffId);
    return this.portfolio.listSlaEvents({
      staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0),
      itemId: Number.isInteger(item) && item > 0 ? item : undefined,
      amStaffId: Number.isInteger(am) && am > 0 ? am : undefined,
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

  @Get('glossary')
  listGlossary(@Req() req: Request, @Query('lifecycle') lifecycle?: string) {
    const hint = Number(lifecycle);
    return this.portfolio.listGlossary({
      staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0),
      lifecycleHint: Number.isInteger(hint) && hint > 0 ? hint : undefined,
    });
  }

  @Post('glossary/:id/approve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingApproveGuard)
  approveGlossary(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.portfolio.approveGlossary({
      staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0),
      glossaryId: id,
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
