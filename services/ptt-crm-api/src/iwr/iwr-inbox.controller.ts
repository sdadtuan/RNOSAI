import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { RequireIwrAction, StaffIwrGuard } from './guards/staff-iwr.guard';
import { IwrInboxService } from './iwr-inbox.service';
import { IwrOrgRepository } from './iwr-reports.repository';
import type { IwrActor, IwrInboxBox } from './iwr.types';

type AuthedReq = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Controller('api/crm/iwr')
@UseGuards(StaffOrInternalKeyGuard, StaffIwrGuard)
export class IwrInboxController {
  constructor(
    private readonly inbox: IwrInboxService,
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

  @Get('inbox')
  @RequireIwrAction('view')
  async listInbox(@Req() req: AuthedReq, @Query('box') box: IwrInboxBox = 'inbox') {
    return this.inbox.list(await this.actor(req), box);
  }

  @Get('search')
  @RequireIwrAction('view')
  async search(@Req() req: AuthedReq, @Query('q') q = '') {
    return this.inbox.search(await this.actor(req), q);
  }

  @Get('directory')
  @RequireIwrAction('view')
  async directory(
    @Req() req: AuthedReq,
    @Query('q') q = '',
    @Query('purpose') purpose: 'cc' | 'to' | 'mention' | 'bcc' = 'cc',
  ) {
    return this.inbox.directory(await this.actor(req), q, purpose);
  }

  @Get('team')
  @RequireIwrAction('view')
  async team(
    @Req() req: AuthedReq,
    @Query('period_start') periodStart: string,
    @Query('period_end') periodEnd: string,
    @Query('template_code') templateCode?: string,
  ) {
    return this.inbox.team(await this.actor(req), {
      period_start: periodStart,
      period_end: periodEnd,
      template_code: templateCode,
    });
  }
}
