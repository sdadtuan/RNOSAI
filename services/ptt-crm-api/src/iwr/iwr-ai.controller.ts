import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { RequireIwrAction, StaffIwrGuard } from './guards/staff-iwr.guard';
import { IwrAiService } from './iwr-ai.service';
import { IwrOrgRepository } from './iwr-reports.repository';
import type { IwrActor, IwrAiFeedbackAction } from './iwr.types';

type AuthedReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

@Controller('api/crm/iwr/ai')
@UseGuards(StaffOrInternalKeyGuard, StaffIwrGuard)
export class IwrAiController {
  constructor(
    private readonly ai: IwrAiService,
    private readonly staffAuth: StaffAuthService,
    private readonly org: IwrOrgRepository,
  ) {}

  private async actor(req: AuthedReq): Promise<IwrActor> {
    if (!req.staffUser) {
      return { staffId: 0, staffLabel: 'system', departmentId: null, caps: [] };
    }
    const me = await this.staffAuth.me(req.staffUser);
    const staffId = (await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0;
    const self = staffId > 0 ? await this.org.getStaff(staffId) : null;
    return {
      staffId,
      staffLabel: me.display_name || me.email || String(staffId),
      departmentId: self?.department_id ?? null,
      caps: me.caps,
    };
  }

  @Get('status')
  @RequireIwrAction('view')
  status() {
    return this.ai.status();
  }

  @Post('summaries')
  @RequireIwrAction('view')
  async summarize(@Req() req: AuthedReq, @Body() body: { report_id: string }) {
    return this.ai.summarize(await this.actor(req), body.report_id);
  }

  @Post('insights')
  @RequireIwrAction('view')
  async insights(@Req() req: AuthedReq, @Body() body: { report_id: string }) {
    return this.ai.insights(await this.actor(req), body.report_id);
  }

  @Post('feedback')
  @RequireIwrAction('view')
  async feedback(
    @Req() req: AuthedReq,
    @Body() body: { report_id: string; action: IwrAiFeedbackAction; note?: string },
  ) {
    return this.ai.feedback(await this.actor(req), body);
  }
}
