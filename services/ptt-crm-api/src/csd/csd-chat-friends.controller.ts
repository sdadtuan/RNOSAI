import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { CsdChatFriendsService } from './csd-chat-friends.service';
import type { CsdActor } from './csd.types';
import { RequireCsdAction, StaffCsdGuard } from './guards/staff-csd.guard';

type AuthedReq = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Controller('api/crm/csd')
@UseGuards(StaffOrInternalKeyGuard, StaffCsdGuard)
export class CsdChatFriendsController {
  constructor(
    private readonly friends: CsdChatFriendsService,
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

  @Get('chat/people')
  @RequireCsdAction('view')
  async people(@Req() req: AuthedReq, @Query('q') q?: string) {
    return this.friends.searchPeople(await this.actor(req), q ?? '');
  }

  @Get('chat/friends/requests')
  @RequireCsdAction('view')
  async requests(@Req() req: AuthedReq) {
    return this.friends.listRequests(await this.actor(req));
  }

  @Get('chat/friends')
  @RequireCsdAction('view')
  async list(@Req() req: AuthedReq) {
    return this.friends.listFriends(await this.actor(req));
  }

  @Post('chat/friends')
  @RequireCsdAction('write')
  async request(@Req() req: AuthedReq, @Body() body: { staff_id: number }) {
    return this.friends.request(await this.actor(req), Number(body.staff_id));
  }

  @Post('chat/friends/:id/accept')
  @RequireCsdAction('write')
  async accept(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.friends.accept(await this.actor(req), id);
  }

  @Post('chat/friends/:id/reject')
  @RequireCsdAction('write')
  async reject(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.friends.reject(await this.actor(req), id);
  }

  @Post('chat/friends/:id/block')
  @RequireCsdAction('write')
  async block(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.friends.block(await this.actor(req), id);
  }

  @Delete('chat/friends/:id')
  @RequireCsdAction('write')
  async remove(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.friends.remove(await this.actor(req), id);
  }

  @Delete('admin/chat-accounts/:staffId/friends/:friendshipId')
  @RequireCsdAction('admin')
  async adminRemove(@Req() req: AuthedReq, @Param('friendshipId') friendshipId: string) {
    return this.friends.adminRemove(await this.actor(req), friendshipId);
  }
}
