import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
import { RequireQuoteSection, StaffQuoteGuard } from './guards/staff-quote.guard';
import { QuoteApprovalService } from './quote-approval.service';
import { QuoteBuilderService, type QuotePaymentItemInput } from './quote-builder.service';
import {
  QuoteOptionsService,
  type QuoteOptionCreateInput,
  type QuoteOptionPatchInput,
} from './quote-options.service';
import { QuoteStudioService } from './quote-studio.service';

type StaffReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

@Controller('api/crm/quote-versions')
@UseGuards(StaffOrInternalKeyGuard, StaffProposalsViewGuard)
export class QuoteVersionsController {
  constructor(
    private readonly builder: QuoteBuilderService,
    private readonly options: QuoteOptionsService,
    private readonly approvals: QuoteApprovalService,
    private readonly studio: QuoteStudioService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  @Put(':vid/payments')
  @UseGuards(StaffProposalsWriteGuard)
  async putPayments(
    @Req() req: StaffReq,
    @Param('vid') vid: string,
    @Body() body: { items?: QuotePaymentItemInput[] },
  ) {
    return this.builder.putPayments(vid, body ?? {}, await this.actor(req));
  }

  @Get(':vid/options')
  async listOptions(@Param('vid') vid: string) {
    return this.options.list(vid);
  }

  @Get(':vid/kpis')
  async listKpis(@Param('vid') vid: string) {
    return this.builder.listKpis(vid);
  }

  @Post(':vid/options')
  @UseGuards(StaffProposalsWriteGuard)
  async createOption(
    @Req() req: StaffReq,
    @Param('vid') vid: string,
    @Body() body: QuoteOptionCreateInput,
  ) {
    return this.options.create(vid, body ?? {}, await this.actor(req));
  }

  @Post(':vid/options/:key/duplicate')
  @UseGuards(StaffProposalsWriteGuard)
  async duplicateOption(
    @Req() req: StaffReq,
    @Param('vid') vid: string,
    @Param('key') key: string,
  ) {
    return this.options.duplicate(vid, key, await this.actor(req));
  }

  @Patch(':vid/options/:key')
  @UseGuards(StaffProposalsWriteGuard)
  async patchOption(
    @Req() req: StaffReq,
    @Param('vid') vid: string,
    @Param('key') key: string,
    @Body() body: QuoteOptionPatchInput,
  ) {
    return this.options.patch(vid, key, body ?? {}, await this.actor(req));
  }

  @Post(':vid/submit-approval')
  @UseGuards(StaffProposalsWriteGuard)
  async submitApproval(@Req() req: StaffReq, @Param('vid') vid: string) {
    return this.approvals.submitApproval(vid, await this.actor(req));
  }

  @Post(':vid/publish')
  @UseGuards(StaffQuoteGuard)
  @RequireQuoteSection('crm_quote.publish', 'execute')
  async publish(@Req() req: StaffReq, @Param('vid') vid: string) {
    return this.studio.publish(vid, await this.actor(req));
  }

  private async actor(req: StaffReq) {
    if (req.staffAuthVia === 'internal' && !req.staffUser) {
      return { staffId: 0, staffAuthVia: 'internal' as const, hasFinance: true };
    }
    const staffId = req.staffUser
      ? await this.staffAuth.resolveCrmStaffUserId(req.staffUser)
      : null;
    if (staffId == null || staffId <= 0) {
      throw new ForbiddenException({ error: 'qt_unresolved_staff' });
    }
    const me = req.staffUser ? await this.staffAuth.me(req.staffUser) : null;
    return {
      staffId,
      staffAuthVia: 'jwt' as const,
      hasFinance: Boolean(me && this.staffAuth.hasCap(me.caps, 'crm_quote.finance', 'view')),
    };
  }
}
