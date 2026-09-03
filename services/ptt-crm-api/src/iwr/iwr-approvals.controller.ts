import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { RequireIwrAction, StaffIwrGuard } from './guards/staff-iwr.guard';
import { IwrApprovalsService } from './iwr-approvals.service';
import { IwrOrgRepository } from './iwr-reports.repository';
import type { CreateIwrApprovalInput, IwrActor } from './iwr.types';

type AuthedReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

@Controller('api/crm/iwr/approvals')
@UseGuards(StaffOrInternalKeyGuard, StaffIwrGuard)
export class IwrApprovalsController {
  constructor(
    private readonly approvals: IwrApprovalsService,
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
    return this.approvals.list(await this.actor(req));
  }

  @Post()
  @RequireIwrAction('view')
  async create(@Req() req: AuthedReq, @Body() body: CreateIwrApprovalInput) {
    return this.approvals.create(await this.actor(req), body);
  }

  @Post(':id/decide')
  @RequireIwrAction('review')
  async decide(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: { status: 'approved' | 'rejected'; note?: string },
  ) {
    return this.approvals.decide(await this.actor(req), id, body);
  }
}
