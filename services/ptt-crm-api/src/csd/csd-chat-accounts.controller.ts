import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { CsdChatAccountsService } from './csd-chat-accounts.service';
import { CsdChatService } from './csd-chat.service';
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
    private readonly chat: CsdChatService,
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

  @Post('chat/login')
  @RequireCsdAction('view')
  async login(@Req() req: AuthedReq, @Body() body: { username?: string; password?: string }) {
    return this.accounts.login(await this.actor(req), body ?? {});
  }

  @Get('admin/chat-accounts')
  @RequireCsdAction('admin')
  async listAdmin(@Req() req: AuthedReq, @Query('q') q?: string) {
    await this.actor(req);
    return this.accounts.listAdmin(q);
  }

  @Get('admin/chat-accounts/directory')
  @RequireCsdAction('admin')
  async directory(@Req() req: AuthedReq) {
    await this.actor(req);
    return this.accounts.listDirectory();
  }

  @Post('admin/chat-accounts')
  @RequireCsdAction('admin')
  async upsert(
    @Req() req: AuthedReq,
    @Body()
    body: {
      staff_id: number;
      enabled: boolean;
      display_name_vi?: string;
      username?: string;
      chat_password?: string;
    },
  ) {
    return this.accounts.upsert(await this.actor(req), body);
  }

  @Get('admin/chat-accounts/groups')
  @RequireCsdAction('admin')
  async listGroups(
    @Req() req: AuthedReq,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    const actor = await this.actor(req);
    return this.chat.listGroupsForAdmin(actor, {
      q,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('admin/chat-accounts/groups/:id')
  @RequireCsdAction('admin')
  async getGroup(@Req() req: AuthedReq, @Param('id') id: string) {
    const actor = await this.actor(req);
    return this.chat.getGroupForAdmin(actor, id);
  }

  @Patch('admin/chat-accounts/groups/:id')
  @RequireCsdAction('admin')
  async patchGroup(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body()
    body: {
      name_vi?: string;
      description?: string;
      clear_avatar?: boolean;
      join_approval_required?: boolean;
      members_can_send?: boolean;
    },
  ) {
    const actor = await this.actor(req);
    return this.chat.patchConversation(actor, id, body ?? {});
  }

  @Post('admin/chat-accounts/groups/:id/members')
  @RequireCsdAction('admin')
  async addGroupMember(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: { member_staff_id: number; role?: 'owner' | 'admin' | 'member' | 'viewer' },
  ) {
    const actor = await this.actor(req);
    return this.chat.addMember(actor, id, body);
  }

  @Patch('admin/chat-accounts/groups/:id/members/:staffId')
  @RequireCsdAction('admin')
  async setGroupMemberRole(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Param('staffId') staffId: string,
    @Body() body: { role?: string },
  ) {
    const actor = await this.actor(req);
    return this.chat.setMemberRole(actor, id, Number(staffId), String(body?.role ?? ''));
  }

  @Delete('admin/chat-accounts/groups/:id/members/:staffId')
  @RequireCsdAction('admin')
  async removeGroupMember(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Param('staffId') staffId: string,
  ) {
    const actor = await this.actor(req);
    return this.chat.removeMember(actor, id, Number(staffId));
  }

  @Post('admin/chat-accounts/groups/:id/transfer-owner')
  @RequireCsdAction('admin')
  async transferGroupOwner(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: { new_owner_staff_id?: number },
  ) {
    const actor = await this.actor(req);
    return this.chat.transferOwner(actor, id, Number(body?.new_owner_staff_id));
  }

  @Post('admin/chat-accounts/groups/:id/join-requests/:requestId/approve')
  @RequireCsdAction('admin')
  async approveGroupJoinRequest(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Param('requestId') requestId: string,
  ) {
    const actor = await this.actor(req);
    return this.chat.approveJoinRequest(actor, id, requestId);
  }

  @Post('admin/chat-accounts/groups/:id/join-requests/:requestId/reject')
  @RequireCsdAction('admin')
  async rejectGroupJoinRequest(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Param('requestId') requestId: string,
  ) {
    const actor = await this.actor(req);
    return this.chat.rejectJoinRequest(actor, id, requestId);
  }
}
