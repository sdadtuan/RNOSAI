import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { CsdChatAccountsService } from './csd-chat-accounts.service';
import type { CsdActor } from './csd.types';
import { RequireCsdAction, StaffCsdGuard } from './guards/staff-csd.guard';

type AuthedReq = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Controller('api/crm/csd')
@UseGuards(StaffOrInternalKeyGuard, StaffCsdGuard)
export class CsdChatAccountsController {
  constructor(
    private readonly accounts: CsdChatAccountsService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private async actor(req: AuthedReq): Promise<CsdActor> {
    if (!req.staffUser) {
      return { staffId: 0, staffLabel: 'system', caps: [] };
    }
    const me = await this.staffAuth.me(req.staffUser);
    const staffId = (await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0;
    return {
      staffId,
      staffLabel: me.display_name || me.email || String(staffId),
      caps: me.caps,
    };
  }

  @Get('chat/me')
  @RequireCsdAction('view')
  async me(@Req() req: AuthedReq) {
    return this.accounts.getMe(await this.actor(req));
  }

  @Get('admin/chat-accounts')
  @RequireCsdAction('admin')
  async listAdmin(@Req() req: AuthedReq, @Query('q') q?: string) {
    await this.actor(req);
    return this.accounts.listAdmin(q);
  }

  @Post('admin/chat-accounts')
  @RequireCsdAction('admin')
  async upsert(
    @Req() req: AuthedReq,
    @Body() body: { staff_id: number; enabled: boolean; display_name_vi?: string },
  ) {
    return this.accounts.upsert(await this.actor(req), body);
  }
}
