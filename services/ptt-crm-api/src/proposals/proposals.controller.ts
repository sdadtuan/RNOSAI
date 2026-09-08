import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import {
  StaffProposalsViewGuard,
  StaffProposalsWriteGuard,
} from './guards/staff-proposals.guard';
import {
  RequireQuoteAction,
  RequireQuoteSection,
  StaffQuoteGuard,
} from './guards/staff-quote.guard';
import { ProposalsService } from './proposals.service';
import { CreateProposalBody, PatchProposalStatusBody, PutQuoteLinesBody } from './proposals.types';
import { QuoteOverviewService, toActivityCsv } from './quote-overview.service';
import { resolveQuoteScope, type QuoteScope } from './quote-scope.util';
import { QuoteSettingsPatch, QuoteSettingsService } from './quote-settings.service';
import type { QuoteBuilderActor } from './quote-builder.service';
import type { QuoteHeaderPatch } from './quote-versions.repository';

type StaffReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

@Controller('api/crm/proposals')
@UseGuards(StaffOrInternalKeyGuard, StaffProposalsViewGuard)
export class ProposalsController {
  constructor(
    private readonly proposals: ProposalsService,
    private readonly quoteSettings: QuoteSettingsService,
    private readonly quoteOverview: QuoteOverviewService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private async quoteCaller(req: StaffReq, requested?: QuoteScope) {
    if (req.staffAuthVia === 'internal' && !req.staffUser) {
      return {
        scope: requested ?? ('all' as const),
        staffId: 0,
        teamIds: [] as number[],
        hasFinance: true,
      };
    }
    const staffId = req.staffUser
      ? await this.staffAuth.resolveCrmStaffUserId(req.staffUser)
      : null;
    if (staffId == null || staffId <= 0) {
      throw new ForbiddenException({ error: 'qt_unresolved_staff' });
    }
    const me = req.staffUser ? await this.staffAuth.me(req.staffUser) : null;
    const has = (section: string, action: string) =>
      Boolean(me && this.staffAuth.hasCap(me.caps, section, action));
    return {
      scope: resolveQuoteScope({
        requested,
        hasViewAll: has('crm_quote', 'view_all') || has('crm_quote', 'manage'),
        canTeam: has('crm_quote', 'edit') || has('crm_quote', 'manage'),
      }),
      staffId,
      teamIds: await this.quoteOverview.loadActorTeamIds(staffId),
      hasFinance: has('crm_quote.finance', 'view'),
    };
  }

  private async assertQuoteAuditCap(req: StaffReq) {
    if (req.staffAuthVia === 'internal') return;
    const me = req.staffUser ? await this.staffAuth.me(req.staffUser) : null;
    const allowed = Boolean(
      me &&
        (this.staffAuth.hasCap(me.caps, 'crm_quote.audit', 'view') ||
          this.staffAuth.hasCap(me.caps, 'crm_quote.audit', 'view_all') ||
          this.staffAuth.hasCap(me.caps, 'crm_quote.audit', 'execute')),
    );
    if (!allowed) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_quote.audit', action: 'view' });
    }
  }

  @Get('quote-catalog')
  getQuoteCatalog(@Query('service_slug') serviceSlug?: string) {
    return this.proposals.getCatalogForQuote(serviceSlug);
  }

  @Get('settings')
  @UseGuards(StaffOrInternalKeyGuard, StaffQuoteGuard)
  @RequireQuoteAction('view')
  getSettings() {
    return this.quoteSettings.get();
  }

  @Patch('settings')
  @UseGuards(StaffOrInternalKeyGuard, StaffQuoteGuard)
  @RequireQuoteSection('crm_quote', 'manage')
  async patchSettings(@Req() req: StaffReq, @Body() body: QuoteSettingsPatch) {
    const staffId = await this.staffAuth.resolveCrmStaffUserId(req.staffUser);
    return this.quoteSettings.patch(body ?? {}, staffId);
  }

  @Get('overview')
  @UseGuards(StaffOrInternalKeyGuard, StaffQuoteGuard)
  @RequireQuoteAction('view')
  async getOverview(
    @Req() req: StaffReq,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('scope') scope?: QuoteScope,
    @Query('owner') owner?: string,
  ) {
    return this.quoteOverview.getOverview({
      ...(await this.quoteCaller(req, scope)),
      from,
      to,
      owner,
    });
  }

  @Get('actions')
  @UseGuards(StaffOrInternalKeyGuard, StaffQuoteGuard)
  @RequireQuoteAction('view')
  async getActions(@Req() req: StaffReq, @Query('scope') scope?: QuoteScope) {
    return this.quoteOverview.getActions(await this.quoteCaller(req, scope));
  }

  @Get('activity')
  @UseGuards(StaffOrInternalKeyGuard, StaffQuoteGuard)
  @RequireQuoteAction('view')
  async getActivity(
    @Req() req: StaffReq,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('action') action?: string,
    @Query('owner') owner?: string,
    @Query('export') exportFmt?: string,
  ) {
    const listed = await this.quoteOverview.listActivity({
      from,
      to,
      action,
      actor_staff_id: owner && /^\d+$/.test(owner) ? Number(owner) : undefined,
    });
    if (exportFmt === 'csv') {
      await this.assertQuoteAuditCap(req);
      return { csv: toActivityCsv(listed.items), filename: 'quote-activity.csv' };
    }
    return listed;
  }

  @Get()
  async list(
    @Req() req: StaffReq,
    @Query('customer_id') customerId?: string,
    @Query('lead_id') leadId?: string,
    @Query('scope') scope?: QuoteScope,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('expiring') expiring?: string,
    @Query('pending_my_approval') pendingMyApproval?: string,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
  ) {
    const hasDealRoom = Boolean(customerId || leadId);
    if (hasDealRoom) {
      return this.proposals.list(customerId, leadId);
    }
    return this.proposals.list(customerId, leadId, {
      ...(await this.quoteCaller(req, scope)),
      status,
      q,
      expiring,
      pending_my_approval: pendingMyApproval,
      page,
      page_size: pageSize,
    });
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.proposals.detail(id);
  }

  @Get(':id/lines')
  getLines(@Param('id', ParseIntPipe) id: number) {
    return this.proposals.getLines(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffProposalsWriteGuard)
  async create(
    @Req() req: StaffReq,
    @Body() body: CreateProposalBody,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (req.staffAuthVia === 'internal' && !req.staffUser) {
      return this.proposals.create(body, {
        staffId: 0,
        staffAuthVia: 'internal',
        idempotencyKey,
      });
    }
    const staffId = req.staffUser
      ? await this.staffAuth.resolveCrmStaffUserId(req.staffUser)
      : null;
    if (staffId == null || staffId <= 0) {
      throw new ForbiddenException({ error: 'qt_unresolved_staff' });
    }
    return this.proposals.create(body, {
      staffId,
      staffAuthVia: 'jwt',
      idempotencyKey,
    });
  }

  @Put(':id/lines')
  @UseGuards(StaffProposalsWriteGuard)
  async putLines(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PutQuoteLinesBody,
  ) {
    return this.proposals.putLines(id, body, await this.quoteWriteActor(req, false));
  }

  @Patch(':id')
  @UseGuards(StaffProposalsWriteGuard)
  async patchHeader(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: QuoteHeaderPatch,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.proposals.patchQuoteHeader(id, body ?? {}, ifMatch, await this.quoteWriteActor(req, true));
  }

  @Post(':id/versions/:vid/convert')
  @UseGuards(StaffOrInternalKeyGuard, StaffQuoteGuard)
  @RequireQuoteSection('crm_quote.convert', 'execute')
  async convert(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Param('vid') vid: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!String(idempotencyKey ?? '').trim()) {
      throw new BadRequestException({ error: 'idempotency_key_required' });
    }
    if (req.staffAuthVia === 'internal' && !req.staffUser) {
      return this.proposals.convert(id, vid, {
        staffId: 0,
        staffAuthVia: 'internal',
        idempotencyKey,
      });
    }
    const staffId = req.staffUser
      ? await this.staffAuth.resolveCrmStaffUserId(req.staffUser)
      : null;
    if (staffId == null || staffId <= 0) {
      throw new ForbiddenException({ error: 'qt_unresolved_staff' });
    }
    return this.proposals.convert(id, vid, {
      staffId,
      staffAuthVia: 'jwt',
      idempotencyKey,
    });
  }

  @Post(':id/versions/:vid/recalculate')
  @UseGuards(StaffProposalsWriteGuard)
  async recalculate(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Param('vid') vid: string,
    @Query('section') section?: string,
  ) {
    const actor = await this.quoteWriteActor(req, true);
    return this.proposals.recalculateQuote(id, vid, {
      ...actor,
      includeFinance: section === 'cost' || section === 'finance',
    });
  }

  @Patch(':id/status')
  @UseGuards(StaffProposalsWriteGuard)
  patchStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchProposalStatusBody,
    @Req() req: StaffReq,
  ) {
    const actor = req.staffUser?.email ?? 'staff';
    return this.proposals.patchStatus(id, body, actor);
  }

  @Post(':id/export')
  @UseGuards(StaffProposalsWriteGuard)
  @Header('Cache-Control', 'no-store')
  exportQuote(
    @Param('id', ParseIntPipe) id: number,
    @Query('format') format?: 'pdf' | 'docx',
  ) {
    return this.proposals.exportQuote(id, format ?? 'pdf');
  }

  @Post(':id/generate')
  @UseGuards(StaffProposalsWriteGuard)
  generate(@Param('id', ParseIntPipe) id: number) {
    return this.proposals.generate(id);
  }

  @Delete(':id')
  @UseGuards(StaffProposalsWriteGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.proposals.remove(id);
  }

  private async quoteWriteActor(req: StaffReq, requireStaff: boolean): Promise<QuoteBuilderActor> {
    if (req.staffAuthVia === 'internal' && !req.staffUser) {
      return { staffId: 0, staffAuthVia: 'internal', hasFinance: true };
    }
    const staffId = req.staffUser
      ? await this.staffAuth.resolveCrmStaffUserId(req.staffUser)
      : null;
    if (requireStaff && (staffId == null || staffId <= 0)) {
      throw new ForbiddenException({ error: 'qt_unresolved_staff' });
    }
    const me = req.staffUser ? await this.staffAuth.me(req.staffUser) : null;
    const hasFinance = Boolean(me && this.staffAuth.hasCap(me.caps, 'crm_quote.finance', 'view'));
    return {
      staffId: staffId && staffId > 0 ? staffId : 0,
      staffAuthVia: req.staffAuthVia === 'internal' ? 'internal' : 'jwt',
      hasFinance,
    };
  }
}
