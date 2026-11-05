import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { RequireIwrAction, StaffIwrGuard } from './guards/staff-iwr.guard';
import { IwrBuilderService } from './iwr-builder.service';
import { IwrOrgRepository } from './iwr-reports.repository';
import type { CreateIwrSavedReportInput, IwrActor } from './iwr.types';

type AuthedReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

@Controller('api/crm/iwr/saved-reports')
@UseGuards(StaffOrInternalKeyGuard, StaffIwrGuard)
export class IwrBuilderController {
  constructor(
    private readonly builder: IwrBuilderService,
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
    return this.builder.list(await this.actor(req));
  }

  @Post()
  @RequireIwrAction('view')
  async create(@Req() req: AuthedReq, @Body() body: CreateIwrSavedReportInput) {
    return this.builder.create(await this.actor(req), body);
  }

  @Post(':id/run')
  @RequireIwrAction('view')
  async run(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.builder.run(await this.actor(req), id);
  }

  @Post(':id/share')
  @RequireIwrAction('view')
  async share(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: { staff_ids?: number[] },
  ) {
    return this.builder.share(await this.actor(req), id, body.staff_ids ?? []);
  }
}
