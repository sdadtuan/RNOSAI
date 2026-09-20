import { Body, Controller, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffJwtGuard } from '../../staff-auth/staff-jwt.guard';
import { StaffAuthService } from '../../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../../staff-auth/staff-jwt.util';
import { ForbiddenException } from '@nestjs/common';
import { OpsPlanGenerateReviewService } from './ops-plan-generate-review.service';
import { OpsPresalesAutofillService } from './ops-presales-autofill.service';

type ReqWithStaff = Request & { staffUser?: StaffJwtPayload };

@Controller('api/crm/presales')
@UseGuards(StaffJwtGuard)
export class PresalesP7Controller {
  constructor(
    private readonly planReview: OpsPlanGenerateReviewService,
    private readonly autofill: OpsPresalesAutofillService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  @Post('lifecycle/:id/generate-plan-review')
  async generatePlanReview(
    @Req() req: ReqWithStaff,
    @Param('id', ParseIntPipe) lifecycleId: number,
    @Body() body: Record<string, unknown>,
  ) {
    await this.assertEdit(req);
    const actor =
      req.staffUser?.email ?? req.staffUser?.sub ?? `staff:${req.staffUser?.sub ?? 'unknown'}`;
    return this.planReview.generateReview(
      {
        ...body,
        lifecycle_id: lifecycleId,
      },
      String(actor),
    );
  }

  @Post('lifecycle/:id/autofill-tmmt')
  async autofillTmmt(
    @Req() req: ReqWithStaff,
    @Param('id', ParseIntPipe) lifecycleId: number,
    @Body() body: Record<string, unknown>,
  ) {
    await this.assertEdit(req);
    return this.autofill.autofill({
      ...body,
      lifecycle_id: lifecycleId,
    });
  }

  private async assertEdit(req: ReqWithStaff) {
    const staffUser = req.staffUser;
    if (!staffUser) throw new ForbiddenException({ error: 'unauthorized' });
    const me = await this.staffAuth.me(staffUser);
    const ok =
      this.staffAuth.hasCap(me.caps, 'crm_board', 'edit') ||
      this.staffAuth.hasCap(me.caps, 'crm_service_lifecycle', 'edit') ||
      this.staffAuth.hasCap(me.caps, 'crm_leads', 'edit');
    if (!ok) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_board', action: 'edit' });
    }
  }
}
