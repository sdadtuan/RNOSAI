import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { RequireIwrAction, StaffIwrGuard } from './guards/staff-iwr.guard';
import { IwrDashboardsService } from './iwr-dashboards.service';
import { IwrOrgRepository } from './iwr-reports.repository';
import type { IwrActor, IwrDashRole } from './iwr.types';

type AuthedReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

@Controller('api/crm/iwr/dashboards')
@UseGuards(StaffOrInternalKeyGuard, StaffIwrGuard)
export class IwrDashboardsController {
  constructor(
    private readonly dashboards: IwrDashboardsService,
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

  @Get(':role')
  @RequireIwrAction('view')
  async get(@Req() req: AuthedReq, @Param('role') role: IwrDashRole) {
    return this.dashboards.get(await this.actor(req), role);
  }
}
