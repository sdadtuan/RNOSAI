import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { StaffAuthService } from '../../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../../staff-auth/staff-jwt.util';
import { P13EnabledGuard, P13FlagsService } from '../p13-enabled.guard';
import type { QuoteActor } from './quote-book';
import type { QuoteLineInput } from './quote-calc';
import { QuoteError } from './quote-error';
import { P13QuoteService, raiseQuote } from './quote.service';

type StaffRequest = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

@Controller('api/crm/p13')
@UseGuards(P13EnabledGuard, StaffOrInternalKeyGuard)
export class P13QuoteController {
  constructor(
    private readonly quotes: P13QuoteService,
    private readonly staffAuth: StaffAuthService,
    private readonly flags: P13FlagsService,
  ) {}

  @Get('settings/quote')
  async getSettings(@Req() req: StaffRequest) {
    try {
      await this.actor(req);
      return { ok: true, data: await this.quotes.settings() };
    } catch (error) {
      raiseQuote(error);
    }
  }

  @Put('settings/quote')
  async putSettings(@Req() req: StaffRequest, @Body() body: Record<string, unknown>) {
    try {
      const actor = await this.actor(req);
      return { ok: true, data: await this.quotes.saveSettings(body, actor) };
    } catch (error) {
      raiseQuote(error);
    }
  }

  @Get('proposals')
  async list(@Req() req: StaffRequest) {
    try {
      return { ok: true, data: await this.quotes.list(await this.actor(req)) };
    } catch (error) {
      raiseQuote(error);
    }
  }

  @Post('proposals')
  async create(@Req() req: StaffRequest, @Body() body: { title?: string; client_name?: string; am_name?: string; is_test?: boolean }) {
    try {
      return { ok: true, data: await this.quotes.create(body, await this.actor(req)) };
    } catch (error) {
      raiseQuote(error);
    }
  }

  @Get('proposals/:id')
  async get(@Req() req: StaffRequest, @Param('id') id: string) {
    try {
      return { ok: true, data: await this.quotes.get(Number(id), await this.actor(req)) };
    } catch (error) {
      raiseQuote(error);
    }
  }

  @Patch('proposals/:id')
  async patch(@Req() req: StaffRequest, @Param('id') id: string, @Body() body: { validity_days?: number | null; extra_discount_pct?: string | null; display_mode?: 'package_only' | 'package_with_scope' | 'item_detail'; title?: string }) {
    try {
      return { ok: true, data: await this.quotes.putLines(Number(id), body, await this.actor(req)) };
    } catch (error) {
      raiseQuote(error);
    }
  }

  @Delete('proposals/:id')
  async remove(@Req() req: StaffRequest, @Param('id') id: string) {
    try {
      const actor = await this.actor(req);
      const quote = await this.quotes.get(Number(id), actor);
      if (quote.status !== 'draft' || quote.p13_approval_status === 'pending') throw new QuoteError(409, 'quote_locked');
      return { ok: true, data: { id: Number(id), archived: true } };
    } catch (error) {
      raiseQuote(error);
    }
  }

  @Delete('proposals/:id/lines/:lineId')
  async deleteLine(@Req() req: StaffRequest, @Param('id') id: string, @Param('lineId') lineId: string) {
    try {
      return { ok: true, data: await this.quotes.deleteLine(Number(id), Number(lineId), await this.actor(req)) };
    } catch (error) {
      raiseQuote(error);
    }
  }

  @Post('proposals/:id/lines')
  @Put('proposals/:id/lines')
  async lines(@Req() req: StaffRequest, @Param('id') id: string, @Body() body: { lines: QuoteLineInput[]; extra_discount_pct?: string | null; validity_days?: number | null }) {
    try {
      return { ok: true, data: await this.quotes.putLines(Number(id), body, await this.actor(req)) };
    } catch (error) {
      raiseQuote(error);
    }
  }

  @Post('proposals/:id/recalculate')
  async recalculate(@Req() req: StaffRequest, @Param('id') id: string) {
    try {
      return { ok: true, data: await this.quotes.recalculate(Number(id), await this.actor(req)) };
    } catch (error) {
      raiseQuote(error);
    }
  }

  @Get('proposals/:id/checks')
  async checks(@Req() req: StaffRequest, @Param('id') id: string) {
    try {
      return { ok: true, data: await this.quotes.checks(Number(id), await this.actor(req)) };
    } catch (error) {
      raiseQuote(error);
    }
  }

  @Post('proposals/:id/submit')
  actSubmit(@Req() req: StaffRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.action(req, id, 'submit', body);
  }

  @Post('proposals/:id/approve')
  actApprove(@Req() req: StaffRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.action(req, id, 'approve', body);
  }

  @Post('proposals/:id/return')
  actReturn(@Req() req: StaffRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.action(req, id, 'return', body);
  }

  @Post('proposals/:id/mark-sent')
  actSent(@Req() req: StaffRequest, @Param('id') id: string, @Body() body: Record<string, unknown>, @Query('dry_run') dryRun?: string) {
    return this.action(req, id, 'mark-sent', { ...body, dry_run: body.dry_run === true || dryRun === 'true' });
  }

  @Post('proposals/:id/accept')
  actAccept(@Req() req: StaffRequest, @Param('id') id: string, @Body() body: Record<string, unknown>, @Query('dry_run') dryRun?: string) {
    return this.action(req, id, 'accept', { ...body, dry_run: body.dry_run === true || dryRun === 'true' });
  }

  @Post('proposals/:id/reject')
  actReject(@Req() req: StaffRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.action(req, id, 'reject', body);
  }

  @Post('proposals/:id/expire')
  actExpire(@Req() req: StaffRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.action(req, id, 'expire', body);
  }

  @Post('proposals/:id/cancel')
  actCancel(@Req() req: StaffRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.action(req, id, 'reject', { ...body, rejected_reason: body.rejected_reason ?? 'cancelled' });
  }

  @Post('proposals/:id/new-version')
  actVersion(@Req() req: StaffRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.action(req, id, 'new-version', body);
  }

  @Post('proposals/:id/export')
  async export(
    @Req() req: StaffRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
    @Body() body: { mode?: 'draft' | 'final'; display_mode?: 'package_only' | 'package_with_scope' | 'item_detail'; dry_run?: boolean },
    @Query('dry_run') dryRun?: string,
  ) {
    if (!(await this.flags.enabled('QUOTE_EXPORT'))) throw new NotFoundException({ ok: false, error: { code: 'not_found', message: 'not_found' } });
    try {
      const actor = await this.actor(req);
      const result = await this.quotes.export(Number(id), { ...body, dry_run: body.dry_run === true || dryRun === 'true' }, actor);
      if (body.dry_run === true || dryRun === 'true') {
        return { ok: true, data: { would_block: result.would_block, codes: result.codes, page_count: result.page_count, file_name: result.file_name } };
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${result.file_name}"`);
      return result.buffer;
    } catch (error) {
      raiseQuote(error);
    }
  }

  @Get('proposals/:id/files')
  async files(@Req() req: StaffRequest, @Param('id') id: string) {
    if (!(await this.flags.enabled('QUOTE_EXPORT'))) throw new NotFoundException({ ok: false, error: { code: 'not_found', message: 'not_found' } });
    try {
      return { ok: true, data: await this.quotes.files(Number(id), await this.actor(req)) };
    } catch (error) {
      raiseQuote(error);
    }
  }

  private async action(req: StaffRequest, id: string, action: string, body: Record<string, unknown>) {
    try {
      return { ok: true, data: await this.quotes.act(Number(id), action, body, await this.actor(req)) };
    } catch (error) {
      raiseQuote(error);
    }
  }

  private async actor(req: StaffRequest): Promise<QuoteActor> {
    if (req.staffAuthVia === 'internal') {
      return { staffId: 0, email: 'internal', seeAll: true, seeMargin: true, seeCost: true, canApprove: true, canEditSettings: false };
    }
    const me = req.staffUser ? await this.staffAuth.me(req.staffUser) : null;
    const caps = me?.caps ?? [];
    const has = (section: string, action: string) => this.staffAuth.hasCap(caps, section, action);
    const position = String(me?.position_code ?? '').toLowerCase();
    const seeAll = position === 'ceo' || position.includes('gdkd') || position.includes('finance') || position.includes('tai-chinh') || position.includes('ke-toan') || has('p13_pricing', 'view');
    return {
      staffId: Number(me?.id ?? req.staffUser?.sub ?? 0) || 0,
      email: req.staffUser?.email || String(req.staffUser?.sub ?? 'staff'),
      seeAll,
      seeMargin: has('p13_quote', 'margin.view'),
      seeCost: has('p13_pricing', 'cost.view'),
      canApprove: has('p13_quote', 'approve_discount'),
      canEditSettings: has('p13_settings', 'quote.edit'),
    };
  }
}
