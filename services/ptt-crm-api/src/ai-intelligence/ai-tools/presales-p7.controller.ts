import { Body, Controller, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffJwtGuard } from '../../staff-auth/staff-jwt.guard';
import { StaffAuthService } from '../../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../../staff-auth/staff-jwt.util';
import { ForbiddenException } from '@nestjs/common';
import { OpsPlanGenerateReviewService } from './ops-plan-generate-review.service';
import { OpsPresalesAutofillService } from './ops-presales-autofill.service';
import { OpsFieldConfirmService } from './ops-field-confirm.service';
import { OpsReturnToAmService } from './ops-return-to-am.service';
import { OpsServiceRecommendService } from './ops-service-recommend.service';
import { OpsConsultDraftService } from './ops-consult-draft.service';

type ReqWithStaff = Request & { staffUser?: StaffJwtPayload };

@Controller('api/crm/presales')
@UseGuards(StaffJwtGuard)
export class PresalesP7Controller {
  constructor(
    private readonly planReview: OpsPlanGenerateReviewService,
    private readonly autofill: OpsPresalesAutofillService,
    private readonly fieldConfirm: OpsFieldConfirmService,
    private readonly returnToAm: OpsReturnToAmService,
    private readonly serviceRecommend: OpsServiceRecommendService,
    private readonly consultDraft: OpsConsultDraftService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  @Post('lifecycle/:id/generate-plan-review')
  async generatePlanReview(
    @Req() req: ReqWithStaff,
    @Param('id', ParseIntPipe) lifecycleId: number,
    @Body() body: Record<string, unknown>,
  ) {
    await this.assertEdit(req);
    const actor = this.actor(req);
    return this.planReview.generateReview(
      {
        ...body,
        lifecycle_id: lifecycleId,
      },
      actor,
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

  @Post('lifecycle/:id/confirm-field')
  async confirmField(
    @Req() req: ReqWithStaff,
    @Param('id', ParseIntPipe) lifecycleId: number,
    @Body() body: Record<string, unknown>,
  ) {
    await this.assertEdit(req);
    return this.fieldConfirm.confirm(
      { ...body, lifecycle_id: lifecycleId },
      this.actor(req),
    );
  }

  @Post('lifecycle/:id/return-to-am')
  async returnToAmAction(
    @Req() req: ReqWithStaff,
    @Param('id', ParseIntPipe) lifecycleId: number,
    @Body() body: Record<string, unknown>,
  ) {
    await this.assertEdit(req);
    return this.returnToAm.returnToAm({ ...body, lifecycle_id: lifecycleId });
  }

  @Post('lifecycle/:id/recommend-service')
  async recommendService(
    @Req() req: ReqWithStaff,
    @Param('id', ParseIntPipe) lifecycleId: number,
    @Body() body: Record<string, unknown>,
  ) {
    await this.assertEdit(req);
    return this.serviceRecommend.recommend({ ...body, lifecycle_id: lifecycleId });
  }

  @Post('lifecycle/:id/draft-consult')
  async draftConsult(
    @Req() req: ReqWithStaff,
    @Param('id', ParseIntPipe) lifecycleId: number,
    @Body() body: Record<string, unknown>,
  ) {
    await this.assertEdit(req);
    return this.consultDraft.draftFromResearch(
      { ...body, lifecycle_id: lifecycleId },
      this.actor(req),
    );
  }

  private actor(req: ReqWithStaff): string {
    return String(
      req.staffUser?.email ?? req.staffUser?.sub ?? `staff:${req.staffUser?.sub ?? 'unknown'}`,
    );
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
