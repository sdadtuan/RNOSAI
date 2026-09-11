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
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  StaffContentMarketingApproveGuard,
  StaffContentMarketingExecuteGuard,
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

  @Post('publications/execute')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingExecuteGuard)
  enqueuePublicationExecute(@Body() body: Record<string, unknown>, @Req() req: Request) {
    return this.portfolio.enqueuePublicationExecute({
      staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0),
      actor: actorEmail(req),
      body: body ?? {},
    });
  }

  @Get('channel-health')
  channelHealth(@Req() req: Request) {
    return this.portfolio.getChannelHealth({
      staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0),
    });
  }

  @Get('channel-accounts')
  listChannelAccounts(@Req() req: Request) {
    return this.portfolio.listChannelAccounts({
      staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0),
    });
  }

  @Post('connectors/:id/disconnect')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  disconnectConnector(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.portfolio.disconnectConnector({
      staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0),
      connectorId: id,
      actor: actorEmail(req),
    });
  }

  @Get('dam')
  listDamAssets(@Req() req: Request, @Query('collection') collection?: string) {
    return this.portfolio.listDamAssets({
      staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0),
      collection,
    });
  }

  @Post('items/:itemId/dam-bind')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  bindDamAsset(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.portfolio.bindDamAsset({
      staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0),
      itemId,
      actor: actorEmail(req),
      body: body ?? {},
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

  @Patch('items/:itemId/legal-hold')
  patchLegalHold(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    const staffReq = req as Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };
    return this.portfolio.patchLegalHold({
      staffId: Number(staffReq.staffUser?.sub ?? 0),
      itemId,
      actor: actorEmail(staffReq),
      body: body ?? {},
      staffUser: staffReq.staffUser,
      staffAuthVia: staffReq.staffAuthVia,
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

  @Post('glossary')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  createGlossary(@Body() body: Record<string, unknown>, @Req() req: Request) {
    return this.portfolio.createGlossary({
      staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0),
      actor: actorEmail(req),
      body: body ?? {},
    });
  }

  @Patch('glossary/:id')
  @UseGuards(StaffContentMarketingWriteGuard)
  patchGlossary(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.portfolio.patchGlossaryDraft({
      staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0),
      glossaryId: id,
      body: body ?? {},
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

  @Get('connectors/facebook/oauth/start.json')
  @UseGuards(StaffContentMarketingWriteGuard)
  startFacebookOAuthJson(@Req() req: Request) {
    return this.portfolio.startFacebookOAuth({
      staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0),
    });
  }

  @Get('connectors/facebook/oauth/start')
  @UseGuards(StaffContentMarketingWriteGuard)
  async startFacebookOAuth(@Req() req: Request, @Res() res: Response) {
    const out = await this.portfolio.startFacebookOAuth({
      staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0),
    });
    const accept = String(req.headers?.accept ?? '');
    const format = String((req.query as { format?: unknown } | undefined)?.format ?? '');
    if (format === 'json' || accept.includes('application/json')) {
      return res.json(out);
    }
    return res.redirect(out.redirect);
  }

}


@Controller('api/crm/content-os/portfolio')
export class ContentOsPortfolioFacebookOAuthCallbackController {
  constructor(private readonly portfolio: ContentOsPortfolioService) {}

  @Get('connectors/facebook/oauth/callback')
  async facebookOAuthCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ) {
    const out = await this.portfolio.facebookOAuthCallback({ code, state });
    return res.redirect(out.redirect);
  }
}
