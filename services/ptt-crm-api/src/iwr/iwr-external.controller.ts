import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { RequireIwrAction, StaffIwrGuard } from './guards/staff-iwr.guard';
import { IwrExternalService } from './iwr-external.service';
import { IwrOrgRepository } from './iwr-reports.repository';
import type { IwrActor } from './iwr.types';

type AuthedReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

@Controller('api/crm/iwr/external')
@UseGuards(StaffOrInternalKeyGuard, StaffIwrGuard)
export class IwrExternalController {
  constructor(
    private readonly external: IwrExternalService,
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

  @Get('shares')
  @RequireIwrAction('external')
  async list(@Req() req: AuthedReq) {
    return this.external.list(await this.actor(req));
  }

  @Post('shares/request')
  @RequireIwrAction('external')
  async requestShare(
    @Req() req: AuthedReq,
    @Body() body: { report_id: string; email: string; approver_staff_id: number },
  ) {
    return this.external.requestShare(
      await this.actor(req),
      body.report_id,
      body.email,
      body.approver_staff_id,
    );
  }

  @Post('shares/approvals/:id/approve')
  @RequireIwrAction('manage')
  async approveShare(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.external.approveShare(await this.actor(req), id);
  }

  @Post('shares/:id/revoke')
  @RequireIwrAction('external')
  async revoke(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.external.revoke(await this.actor(req), id);
  }
}
