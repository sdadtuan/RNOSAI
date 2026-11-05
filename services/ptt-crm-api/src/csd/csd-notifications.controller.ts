import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { CsdNotificationsService } from './csd-notifications.service';
import { RequireCsdAction, StaffCsdGuard } from './guards/staff-csd.guard';

type AuthedReq = Request & { staffUser?: StaffJwtPayload };

@Controller('api/crm/csd/notifications')
@UseGuards(StaffOrInternalKeyGuard, StaffCsdGuard)
export class CsdNotificationsController {
  constructor(
    private readonly notifications: CsdNotificationsService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private async staffId(req: AuthedReq): Promise<number> {
    if (!req.staffUser) return 0;
    return (await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0;
  }

  @Get()
  @RequireCsdAction('view')
  async list(@Req() req: AuthedReq, @Query('unread') unread?: string) {
    return this.notifications.list(await this.staffId(req), unread === '1' || unread === 'true');
  }

  @Post(':id/read')
  @RequireCsdAction('view')
  async markRead(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.notifications.markRead(await this.staffId(req), id);
  }
}
