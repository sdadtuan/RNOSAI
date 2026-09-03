import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { RequireIwrAction, StaffIwrGuard } from './guards/staff-iwr.guard';
import { IwrWebhooksService } from './iwr-webhooks.service';
import { IwrOrgRepository } from './iwr-reports.repository';
import type { CreateIwrWebhookInput, IwrActor } from './iwr.types';

type AuthedReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

@Controller('api/crm/iwr/webhooks')
@UseGuards(StaffOrInternalKeyGuard, StaffIwrGuard)
export class IwrWebhooksController {
  constructor(
    private readonly webhooks: IwrWebhooksService,
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
  @RequireIwrAction('manage')
  async list(@Req() req: AuthedReq) {
    return this.webhooks.list(await this.actor(req));
  }

  @Post()
  @RequireIwrAction('manage')
  async create(@Req() req: AuthedReq, @Body() body: CreateIwrWebhookInput) {
    return this.webhooks.create(await this.actor(req), body);
  }

  @Post(':id/test')
  @RequireIwrAction('manage')
  async test(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.webhooks.test(await this.actor(req), id);
  }
}
