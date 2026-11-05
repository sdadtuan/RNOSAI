import { Body, Controller, ForbiddenException, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { CsdChatPushService } from './csd-chat-push.service';
import { CsdChatSessionService } from './csd-chat-session.service';
import { RequireCsdAction, StaffCsdGuard } from './guards/staff-csd.guard';

type AuthedReq = Request & { staffUser?: StaffJwtPayload };

@Controller('api/crm/csd/chat')
export class CsdChatSessionController {
  constructor(
    private readonly sessions: CsdChatSessionService,
    private readonly push: CsdChatPushService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  @Post('session')
  open(@Body() body: { username?: string; password?: string }) {
    return this.sessions.openSession(body ?? {});
  }

  @Post('devices')
  @UseGuards(StaffOrInternalKeyGuard, StaffCsdGuard)
  @RequireCsdAction('view')
  async register(
    @Req() req: AuthedReq,
    @Body() body: { platform?: string; token?: string },
  ) {
    if (!req.staffUser) {
      throw new ForbiddenException({ error: 'csd_unresolved_staff' });
    }
    const staffId = (await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0;
    if (staffId <= 0) {
      throw new ForbiddenException({ error: 'csd_unresolved_staff' });
    }
    return this.push.registerDevice(staffId, body ?? {});
  }
}
