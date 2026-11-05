import { Body, Controller, ForbiddenException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { RequireQuoteSection, StaffQuoteGuard } from './guards/staff-quote.guard';
import { QuoteApprovalService, type QuoteApprovalActionInput } from './quote-approval.service';

type StaffReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

@Controller('api/crm/quote-approval-steps')
@UseGuards(StaffOrInternalKeyGuard, StaffQuoteGuard)
export class QuoteApprovalStepsController {
  constructor(
    private readonly approvals: QuoteApprovalService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  @Post(':sid/actions')
  @RequireQuoteSection('crm_quote.approve', 'execute')
  async act(
    @Req() req: StaffReq,
    @Param('sid') sid: string,
    @Body() body: QuoteApprovalActionInput,
  ) {
    return this.approvals.actOnStep(sid, body ?? {}, await this.actor(req));
  }

  private async actor(req: StaffReq) {
    if (req.staffAuthVia === 'internal' && !req.staffUser) {
      return { staffId: 0, staffAuthVia: 'internal' as const };
    }
    const staffId = req.staffUser
      ? await this.staffAuth.resolveCrmStaffUserId(req.staffUser)
      : null;
    if (staffId == null || staffId <= 0) {
      throw new ForbiddenException({ error: 'qt_unresolved_staff' });
    }
    return { staffId, staffAuthVia: 'jwt' as const };
  }
}
