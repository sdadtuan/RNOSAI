import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { CpOverviewService } from './cp-overview.service';
import { CpScope, resolveCpScope } from './cp-scope.util';
import { RequireCpAction, StaffCpGuard } from './guards/staff-cp.guard';

type AuthedReq = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

type OverviewQuery = {
  scope?: CpScope;
  from?: string;
  to?: string;
  client?: string;
  lifecycle?: string;
  owner?: string;
  cursor?: string;
};

@Controller('api/crm/cp')
@UseGuards(StaffOrInternalKeyGuard, StaffCpGuard)
export class CpController {
  constructor(
    private readonly overview: CpOverviewService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private async scope(req: AuthedReq, requested?: CpScope) {
    if (req.staffAuthVia === 'internal' && !req.staffUser) {
      return { scope: requested ?? ('all' as const), staffId: 0, teamIds: [] };
    }
    const staffId = req.staffUser
      ? ((await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0)
      : 0;
    const me = req.staffUser ? await this.staffAuth.me(req.staffUser) : null;
    const has = (action: string) =>
      me ? this.staffAuth.hasCap(me.caps, 'crm_cp', action) : false;
    return {
      scope: resolveCpScope({
        requested,
        hasViewAll: has('view_all') || has('manage'),
        canTeam: has('edit') || has('manage'),
      }),
      staffId,
      teamIds: me?.teams?.map((team) => team.id) ?? [],
    };
  }

  @Get('overview/kpis')
  @RequireCpAction('view')
  async kpis(@Req() req: AuthedReq, @Query() query: OverviewQuery) {
    return this.overview.getKpis({
      ...(await this.scope(req, query.scope)),
      from: query.from,
      to: query.to,
      clientId: query.client,
      lifecycleId: query.lifecycle,
      ownerId: query.owner,
    });
  }

  @Get('overview/actions')
  @RequireCpAction('view')
  async actions(@Req() req: AuthedReq, @Query('scope') scope?: CpScope) {
    return this.overview.getActions(await this.scope(req, scope));
  }

  @Get('overview/health')
  @RequireCpAction('view')
  health() {
    return this.overview.getHealth();
  }

  @Get('activity')
  @RequireCpAction('view')
  async activity(@Req() req: AuthedReq, @Query() query: OverviewQuery) {
    return this.overview.listActivity({
      ...(await this.scope(req, query.scope)),
      cursor: query.cursor,
    });
  }
}
