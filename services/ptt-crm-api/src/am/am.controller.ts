import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { AmDashboardService } from './am-dashboard.service';
import { AmTasksService, type AmCreateTaskInput } from './am-tasks.service';
import { RequireAmAction, StaffAmGuard } from './guards/staff-am.guard';
import type { AmScope } from './am.types';

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
    private readonly staffAuth: StaffAuthService,
  ) {}

  private async actorStaffId(req: AuthedReq): Promise<number> {
    if (!req.staffUser) return 0;
    return (await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0;
  }

  @Get('command-center')
  @RequireAmAction('view')
  commandCenter(@Req() req: AuthedReq, @Query() q: { from?: string; to?: string; scope?: AmScope }) {
    return this.dashboard.get(req, q);
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
}
