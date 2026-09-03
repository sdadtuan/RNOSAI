import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { RequireIwrAction, StaffIwrGuard } from './guards/staff-iwr.guard';
import { IwrOrgRepository } from './iwr-reports.repository';
import { IwrRisksService } from './iwr-risks.service';
import type { IwrActor } from './iwr.types';

type AuthedReq = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Controller('api/crm/iwr/risks')
@UseGuards(StaffOrInternalKeyGuard, StaffIwrGuard)
export class IwrRisksController {
  constructor(
    private readonly risks: IwrRisksService,
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

  @Get()
  @RequireIwrAction('view')
  async list(@Req() req: AuthedReq) {
    return this.risks.list(await this.actor(req));
  }

  @Post()
  @RequireIwrAction('write')
  async createFromBlocker(
    @Req() req: AuthedReq,
    @Body() body: { report_id: string; item_id: string },
  ) {
    return this.risks.createFromBlocker(await this.actor(req), body.report_id, body.item_id);
  }

  @Post(':id/close')
  @RequireIwrAction('write')
  async close(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.risks.close(await this.actor(req), id);
  }

  @Post(':id/assign')
  @RequireIwrAction('review')
  async assign(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: { owner_staff_id: number },
  ) {
    return this.risks.assign(await this.actor(req), id, Number(body.owner_staff_id));
  }
}
