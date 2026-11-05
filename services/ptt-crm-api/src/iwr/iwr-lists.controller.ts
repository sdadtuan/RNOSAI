import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { RequireIwrAction, StaffIwrGuard } from './guards/staff-iwr.guard';
import { IwrListsService } from './iwr-lists.service';
import { IwrOrgRepository } from './iwr-reports.repository';
import type { IwrActor, IwrListRow } from './iwr.types';

type AuthedReq = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Controller('api/crm/iwr/lists')
@UseGuards(StaffOrInternalKeyGuard, StaffIwrGuard)
export class IwrListsController {
  constructor(
    private readonly lists: IwrListsService,
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
  @RequireIwrAction('lists')
  async list(@Req() req: AuthedReq) {
    return this.lists.list(await this.actor(req));
  }

  @Post()
  @RequireIwrAction('lists')
  async create(@Req() req: AuthedReq, @Body() body: Omit<IwrListRow, 'id' | 'owner_staff_id'>) {
    return this.lists.create(await this.actor(req), body);
  }

  @Patch(':id')
  @RequireIwrAction('lists')
  async patch(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: Partial<Pick<IwrListRow, 'name_vi' | 'rule_json' | 'active'>>,
  ) {
    return this.lists.patch(await this.actor(req), id, body);
  }

  @Post(':id/members')
  @RequireIwrAction('lists')
  async addMember(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: { staff_id: number },
  ) {
    return this.lists.addMember(await this.actor(req), id, Number(body.staff_id));
  }

  @Post(':id/preview-dynamic')
  @RequireIwrAction('lists')
  async preview(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.lists.previewDynamic(await this.actor(req), id);
  }
}
