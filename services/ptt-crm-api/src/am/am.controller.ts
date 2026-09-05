import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import {
  AmAccountsService,
  type AmAccountsListQuery,
  type AmCreateAccountBody,
  type AmMergeAccountBody,
  type AmPatchAccountBody,
  type AmTransferBody,
} from './am-accounts.service';
import { AmDashboardService } from './am-dashboard.service';
import { AmHealthService } from './am-health.service';
import { AmPlansService, type AmCreatePlanInput } from './am-plans.service';
import { AmSearchService } from './am-search.service';
import { AmNotificationsService } from './am-notifications.service';
import { AmSettingsService } from './am-settings.service';
import { AmTasksService, type AmCreateTaskInput } from './am-tasks.service';
import { AmViewsService, type AmCreateViewBody } from './am-views.service';
import {
  AmOnboardingService,
  type AmHandoverChecklist,
  type AmHandoverListQuery,
} from './am-onboarding.service';
import { RequireAmAction, StaffAmGuard } from './guards/staff-am.guard';
import type { AmScope } from './am.types';
import type { StaffSectionCap } from '../staff-auth/staff-auth.types';

export type AuthedReq = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Controller('api/crm/am')
@UseGuards(StaffOrInternalKeyGuard, StaffAmGuard)
export class AmController {
  constructor(
    private readonly dashboard: AmDashboardService,
    private readonly tasks: AmTasksService,
    private readonly accounts: AmAccountsService,
    private readonly plans: AmPlansService,
    private readonly searchService: AmSearchService,
    private readonly health: AmHealthService,
    private readonly settings: AmSettingsService,
    private readonly notifications: AmNotificationsService,
    private readonly views: AmViewsService,
    private readonly onboarding: AmOnboardingService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private async actorStaffId(req: AuthedReq): Promise<number> {
    if (!req.staffUser) return 0;
    return (await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0;
  }

  private async actorCaps(req: AuthedReq): Promise<StaffSectionCap[]> {
    if (req.staffAuthVia === 'internal' || !req.staffUser) return [];
    return (await this.staffAuth.me(req.staffUser)).caps;
  }

  @Get('command-center')
  @RequireAmAction('view')
  commandCenter(@Req() req: AuthedReq, @Query() q: { from?: string; to?: string; scope?: AmScope }) {
    return this.dashboard.get(req, q);
  }

  @Get('search')
  @RequireAmAction('view')
  search(@Req() req: AuthedReq, @Query() q: { q?: string; scope?: AmScope }) {
    return this.searchService.search(req, q);
  }

  @Get('settings')
  @RequireAmAction('view')
  getSettings() {
    return this.settings.get();
  }

  @Get('notifications')
  @RequireAmAction('view')
  async listNotifications(@Req() req: AuthedReq) {
    return this.notifications.list(await this.actorStaffId(req));
  }

  @Post('health/recompute')
  @RequireAmAction('manage')
  async recomputeHealth(@Req() req: AuthedReq, @Body() body?: { as_of?: string }) {
    return this.health.recompute({
      asOf: body?.as_of,
      actorStaffId: await this.actorStaffId(req),
    });
  }

  @Post('tasks')
  @RequireAmAction('edit')
  async createTask(@Req() req: AuthedReq, @Body() body: AmCreateTaskInput) {
    return this.tasks.create(body, await this.actorStaffId(req));
  }

  @Post('tasks/dismiss')
  @RequireAmAction('edit')
  async dismissTask(
    @Req() req: AuthedReq,
    @Body() body: { source: string; source_ref: string },
  ) {
    return this.tasks.dismiss(body, await this.actorStaffId(req));
  }

  @Post('tasks/:id/accept')
  @RequireAmAction('edit')
  async acceptTask(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.tasks.accept(id, await this.actorStaffId(req));
  }

  @Get('accounts')
  @RequireAmAction('view')
  async listAccounts(@Req() req: AuthedReq, @Query() q: AmAccountsListQuery) {
    return this.accounts.list(req, q);
  }

  @Post('accounts')
  @RequireAmAction('edit')
  async createAccount(@Req() req: AuthedReq, @Body() body: AmCreateAccountBody) {
    return this.accounts.createAccount(body, {
      staffId: await this.actorStaffId(req),
      caps: await this.actorCaps(req),
      via: req.staffAuthVia,
    });
  }

  @Post('accounts/transfer')
  @RequireAmAction('assign')
  async transferAccounts(@Req() req: AuthedReq, @Body() body: AmTransferBody) {
    return this.accounts.transfer(body, {
      staffId: await this.actorStaffId(req),
      caps: await this.actorCaps(req),
      via: req.staffAuthVia === 'internal' ? 'internal' : 'jwt',
    });
  }

  @Get('accounts/:agencyClientId')
  @RequireAmAction('view')
  async getAccount(@Req() req: AuthedReq, @Param('agencyClientId') agencyClientId: string) {
    return this.accounts.get(req, agencyClientId);
  }

  @Patch('accounts/:agencyClientId')
  @RequireAmAction('edit')
  async patchAccount(
    @Req() req: AuthedReq,
    @Param('agencyClientId') agencyClientId: string,
    @Body() body: AmPatchAccountBody,
  ) {
    return this.accounts.patch(req, agencyClientId, body, {
      staffId: await this.actorStaffId(req),
      caps: await this.actorCaps(req),
      via: req.staffAuthVia === 'internal' ? 'internal' : 'jwt',
    });
  }

  @Post('accounts/:agencyClientId/merge')
  @RequireAmAction('manage')
  async mergeAccount(
    @Req() req: AuthedReq,
    @Param('agencyClientId') agencyClientId: string,
    @Body() body: AmMergeAccountBody,
  ) {
    return this.accounts.merge(req, agencyClientId, body, {
      staffId: await this.actorStaffId(req),
      caps: await this.actorCaps(req),
      via: req.staffAuthVia === 'internal' ? 'internal' : 'jwt',
    });
  }

  @Get('views')
  @RequireAmAction('view')
  async listViews(@Req() req: AuthedReq) {
    return this.views.list(await this.actorStaffId(req));
  }

  @Post('views')
  @RequireAmAction('view')
  async createView(@Req() req: AuthedReq, @Body() body: AmCreateViewBody) {
    return this.views.create(body, {
      staffId: await this.actorStaffId(req),
      caps: await this.actorCaps(req),
    });
  }

  @Post('plans')
  @RequireAmAction('edit')
  async createPlan(@Req() req: AuthedReq, @Body() body: AmCreatePlanInput) {
    return this.plans.create(body, await this.actorStaffId(req));
  }

  @Get('handovers')
  @RequireAmAction('view')
  listHandovers(@Req() req: AuthedReq, @Query() q: AmHandoverListQuery) {
    return this.onboarding.list(req, q);
  }

  @Get('handovers/:id')
  @RequireAmAction('view')
  getHandover(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.onboarding.get(req, id);
  }

  @Post('handovers/:id/accept')
  @RequireAmAction('edit')
  async acceptHandover(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: { checklist?: AmHandoverChecklist },
  ) {
    return this.onboarding.accept(req, id, body ?? {}, await this.actorStaffId(req));
  }

  @Post('handovers/:id/reject')
  @RequireAmAction('edit')
  async rejectHandover(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.onboarding.reject(req, id, body ?? {}, await this.actorStaffId(req));
  }

  @Post('handovers/:id/needs-info')
  @RequireAmAction('edit')
  async needsInfoHandover(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.onboarding.needsInfo(req, id, body ?? {}, await this.actorStaffId(req));
  }
}
