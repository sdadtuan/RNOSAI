import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { RequireIwrAction, StaffIwrGuard } from './guards/staff-iwr.guard';
import { IwrOrgRepository } from './iwr-reports.repository';
import { IwrReportsService } from './iwr-reports.service';
import type { IwrActor, UpdateIwrTemplateInput } from './iwr.types';

type AuthedReq = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Controller('api/crm/iwr/templates')
@UseGuards(StaffOrInternalKeyGuard, StaffIwrGuard)
export class IwrTemplatesController {
  constructor(
    private readonly reports: IwrReportsService,
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
    return this.reports.listTemplates(await this.actor(req));
  }

  @Patch(':id')
  @RequireIwrAction('manage')
  async update(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: UpdateIwrTemplateInput,
  ) {
    return this.reports.updateTemplate(await this.actor(req), id, body);
  }
}
