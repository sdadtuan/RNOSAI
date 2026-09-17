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
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import type { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { ContentOsPortfolioService } from './content-os-portfolio.service';

type StaffReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

function actorEmail(req: StaffReq): string {
  if (req.staffAuthVia === 'internal') return 'internal';
  return req.staffUser?.email ?? 'unknown';
}

@Controller('api/crm/content-os/portfolio')
@UseGuards(StaffOrInternalKeyGuard, StaffContentMarketingViewGuard)
export class ContentOsPortfolioController {
  constructor(
    private readonly portfolio: ContentOsPortfolioService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  /** UUID JWT `sub` must map to numeric crm_staff.id for lifecycle scope. */
  private async staffId(req: Request): Promise<number> {
    return (await this.staffAuth.resolveCrmStaffUserId((req as StaffReq).staffUser)) ?? 0;
  }

  @Get('command-center')
  async commandCenter(@Req() req: Request, @Query('lifecycle') lifecycle?: string) {
    const hint = Number(lifecycle);
    return this.portfolio.getCommandCenter({
      staffId: await this.staffId(req),
      lifecycleHint: Number.isInteger(hint) && hint > 0 ? hint : undefined,
    });
  }

  @Get('approvals')
  async approvals(@Req() req: Request) {
    return this.portfolio.listApprovals({ staffId: await this.staffId(req) });
  }

  @Post('approvals/batch')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingApproveGuard)
  async batchApprove(@Body() body: Record<string, unknown>, @Req() req: Request) {
    return this.portfolio.batchApprove({
      staffId: await this.staffId(req),
      actor: actorEmail(req as StaffReq),
      item_ids: body.item_ids,
      step: body.step != null ? String(body.step) : undefined,
    });
  }

  @Post('approvals/:packageId/delegate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingApproveGuard)
  async delegateApproval(
    @Param('packageId', ParseIntPipe) packageId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.portfolio.delegateApproval({
      staffId: await this.staffId(req),
      actor: actorEmail(req as StaffReq),
      packageId,
      delegate_until: body.delegate_until,
      delegate_to: body.delegate_to != null ? String(body.delegate_to) : undefined,
    });
  }

  @Get('publications')
  async publications(@Req() req: Request, @Query('from') from?: string, @Query('to') to?: string) {
    return this.portfolio.listPublications({
      staffId: await this.staffId(req),
      from,
      to,
    });
  }

  @Post('publications/execute')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingExecuteGuard)
  async enqueuePublicationExecute(@Body() body: Record<string, unknown>, @Req() req: Request) {
    return this.portfolio.enqueuePublicationExecute({
      staffId: await this.staffId(req),
      actor: actorEmail(req as StaffReq),
      body: body ?? {},
    });
  }

  @Get('channel-health')
  async channelHealth(@Req() req: Request) {
    return this.portfolio.getChannelHealth({
      staffId: await this.staffId(req),
    });
  }

  @Get('channel-accounts')
  async listChannelAccounts(@Req() req: Request) {
    return this.portfolio.listChannelAccounts({
      staffId: await this.staffId(req),
    });
  }

  @Post('connectors/:id/disconnect')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  async disconnectConnector(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.portfolio.disconnectConnector({
      staffId: await this.staffId(req),
      connectorId: id,
      actor: actorEmail(req as StaffReq),
    });
  }

  @Get('dam')
  async listDamAssets(@Req() req: Request, @Query('collection') collection?: string) {
    return this.portfolio.listDamAssets({
      staffId: await this.staffId(req),
      collection,
    });
  }

  @Post('items/:itemId/dam-bind')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  async bindDamAsset(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.portfolio.bindDamAsset({
      staffId: await this.staffId(req),
      itemId,
      actor: actorEmail(req as StaffReq),
      body: body ?? {},
    });
  }

  @Get('audit/export')
  @UseGuards(StaffContentMarketingWriteGuard)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="cmkt-audit-export.csv"')
  async exportAuditCsv(@Req() req: Request) {
    return this.portfolio.exportAuditCsv({
      staffId: await this.staffId(req),
      actor: actorEmail(req as StaffReq),
    });
  }

  @Get('settings')
  async getSettings(@Req() req: Request) {
    return this.portfolio.getSettings({
      staffId: await this.staffId(req),
    });
  }

  @Patch('settings')
  @UseGuards(StaffContentMarketingWriteGuard)
  async patchSettings(@Body() body: Record<string, unknown>, @Req() req: Request) {
    return this.portfolio.patchSettings({
      staffId: await this.staffId(req),
      actor: actorEmail(req as StaffReq),
      body: body ?? {},
    });
  }

  @Get('items/:itemId/ai-traces')
  @UseGuards(StaffContentMarketingGenerateGuard)
  async listAiTraces(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Req() req: Request,
    @Query('lifecycle') lifecycle?: string,
  ) {
    const hint = Number(lifecycle);
    return this.portfolio.listAiTraces({
      staffId: await this.staffId(req),
      itemId,
      lifecycleHint: Number.isInteger(hint) && hint > 0 ? hint : undefined,
    });
  }

  @Patch('items/:itemId/legal-hold')
  async patchLegalHold(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    const staffReq = req as StaffReq;
    return this.portfolio.patchLegalHold({
      staffId: await this.staffId(req),
      itemId,
      actor: actorEmail(staffReq),
      body: body ?? {},
      staffUser: staffReq.staffUser,
      staffAuthVia: staffReq.staffAuthVia,
    });
  }

  @Get('items/:itemId')
  async getPortfolioItem(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Req() req: Request,
    @Query('lifecycle') lifecycle?: string,
  ) {
    const hint = Number(lifecycle);
    return this.portfolio.getPortfolioItem({
      staffId: await this.staffId(req),
      itemId,
      lifecycleHint: Number.isInteger(hint) && hint > 0 ? hint : undefined,
    });
  }

  @Get('requests')
  async listRequests(@Req() req: Request) {
    return this.portfolio.listRequests({
      staffId: await this.staffId(req),
    });
  }

  @Post('requests')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  async createRequest(@Body() body: Record<string, unknown>, @Req() req: Request) {
    return this.portfolio.createRequest({
      staffId: await this.staffId(req),
      lifecycleId: Number(body.lifecycle_id),
      actor: actorEmail(req as StaffReq),
      body,
    });
  }

  @Get('sla-events')
  async listSlaEvents(
    @Req() req: Request,
    @Query('item_id') itemId?: string,
    @Query('am_staff_id') amStaffId?: string,
  ) {
    const item = Number(itemId);
    const am = Number(amStaffId);
    return this.portfolio.listSlaEvents({
      staffId: await this.staffId(req),
      itemId: Number.isInteger(item) && item > 0 ? item : undefined,
      amStaffId: Number.isInteger(am) && am > 0 ? am : undefined,
    });
  }

  @Get('insights')
  async listInsights(@Req() req: Request, @Query('lifecycle') lifecycle?: string) {
    const hint = Number(lifecycle);
    return this.portfolio.listInsights({
      staffId: await this.staffId(req),
      lifecycleHint: Number.isInteger(hint) && hint > 0 ? hint : undefined,
    });
  }

  @Post('insights/:id/approve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingApproveGuard)
  async approveInsight(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.portfolio.approveInsight({
      staffId: await this.staffId(req),
      insightId: id,
    });
  }

  @Get('glossary')
  async listGlossary(@Req() req: Request, @Query('lifecycle') lifecycle?: string) {
    const hint = Number(lifecycle);
    return this.portfolio.listGlossary({
      staffId: await this.staffId(req),
      lifecycleHint: Number.isInteger(hint) && hint > 0 ? hint : undefined,
    });
  }

  @Post('glossary')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  async createGlossary(@Body() body: Record<string, unknown>, @Req() req: Request) {
    return this.portfolio.createGlossary({
      staffId: await this.staffId(req),
      actor: actorEmail(req as StaffReq),
      body: body ?? {},
    });
  }

  @Patch('glossary/:id')
  @UseGuards(StaffContentMarketingWriteGuard)
  async patchGlossary(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.portfolio.patchGlossaryDraft({
      staffId: await this.staffId(req),
      glossaryId: id,
      body: body ?? {},
    });
  }

  @Post('glossary/:id/approve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingApproveGuard)
  async approveGlossary(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.portfolio.approveGlossary({
      staffId: await this.staffId(req),
      glossaryId: id,
    });
  }

  @Post('requests/:id/convert')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  async convertRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.portfolio.convertRequest({
      staffId: await this.staffId(req),
      requestId: id,
      actor: actorEmail(req as StaffReq),
      body: body ?? {},
    });
  }

  @Get('connectors/facebook/oauth/start.json')
  @UseGuards(StaffContentMarketingWriteGuard)
  async startFacebookOAuthJson(@Req() req: Request) {
    return this.portfolio.startFacebookOAuth({
      staffId: await this.staffId(req),
    });
  }

  @Get('connectors/facebook/oauth/start')
  @UseGuards(StaffContentMarketingWriteGuard)
  async startFacebookOAuth(@Req() req: Request, @Res() res: Response) {
    const out = await this.portfolio.startFacebookOAuth({
      staffId: await this.staffId(req),
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
