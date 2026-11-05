import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { RequireIwrAction, StaffIwrGuard } from './guards/staff-iwr.guard';
import { IwrSchedulesService } from './iwr-schedule-worker.service';
import { IwrDelegationsService } from './iwr-w4.service';
import { IwrOrgRepository } from './iwr-reports.repository';
import type { IwrActor } from './iwr.types';

type AuthedReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

@Controller('api/crm/iwr')
@UseGuards(StaffOrInternalKeyGuard, StaffIwrGuard)
export class IwrSchedulesController {
  constructor(
    private readonly schedules: IwrSchedulesService,
    private readonly delegations: IwrDelegationsService,
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

  @Get('schedules')
  @RequireIwrAction('schedule')
  async listSchedules(@Req() req: AuthedReq) {
    return this.schedules.list();
  }

  @Get('delegations')
  @RequireIwrAction('review')
  async listDelegations(@Req() req: AuthedReq) {
    return this.delegations.list(await this.actor(req));
  }

  @Post('delegations')
  @RequireIwrAction('review')
  async createDelegation(
    @Req() req: AuthedReq,
    @Body() body: { delegate_staff_id: number; starts_at: string; ends_at: string },
  ) {
    return this.delegations.create(await this.actor(req), body);
  }
}
