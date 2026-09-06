import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import type { StaffSectionCap } from '../staff-auth/staff-auth.types';
import { RequireRevopsAction, StaffRevopsGuard } from './guards/staff-revops.guard';
import { RevopsDashboardService } from './revops-dashboard.service';
import type { RevopsCommandCenterDto } from './revops.types';
import { RevopsPipelineService } from './revops-pipeline.service';
import type { RevopsPipelineDto } from './revops.types';

type AuthedReq = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Controller('api/crm/revops')
@UseGuards(StaffOrInternalKeyGuard, StaffRevopsGuard)
export class RevopsController {
  constructor(
    private readonly dashboard: RevopsDashboardService,
    private readonly pipeline: RevopsPipelineService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  @Get('command-center')
  @RequireRevopsAction('view')
  async commandCenter(
    @Req() req: AuthedReq,
    @Query('period') period?: string,
    @Query('bu') bu?: string,
    @Query('scope') scope?: string,
  ): Promise<RevopsCommandCenterDto> {
    const staffId = req.staffUser ? ((await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0) : 0;
    const caps: StaffSectionCap[] =
      req.staffAuthVia === 'internal' || !req.staffUser ? [] : (await this.staffAuth.me(req.staffUser)).caps;
    return this.dashboard.get({ staffId, caps }, { period, bu, scope });
  }

  @Get('pipeline')
  @RequireRevopsAction('view')
  async pipelineView(
    @Req() req: AuthedReq,
    @Query('view') view?: string,
    @Query('scope') scope?: string,
  ): Promise<RevopsPipelineDto> {
    const staffId = req.staffUser ? ((await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0) : 0;
    const caps: StaffSectionCap[] =
      req.staffAuthVia === 'internal' || !req.staffUser ? [] : (await this.staffAuth.me(req.staffUser)).caps;
    return this.pipeline.get({ staffId, caps }, { view, scope });
  }
}
