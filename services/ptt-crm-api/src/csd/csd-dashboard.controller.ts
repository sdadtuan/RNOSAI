import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { CsdDashboardService } from './csd-dashboard.service';
import { RequireCsdAction, StaffCsdGuard } from './guards/staff-csd.guard';

type AuthedReq = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Controller('api/crm/csd')
@UseGuards(StaffOrInternalKeyGuard, StaffCsdGuard)
export class CsdDashboardController {
  constructor(
    private readonly dashboard: CsdDashboardService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  @Get('dashboard')
  @RequireCsdAction('view')
  async get(@Req() req: AuthedReq) {
    const staffId = req.staffUser
      ? ((await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0)
      : 0;
    return this.dashboard.get(staffId);
  }
}
