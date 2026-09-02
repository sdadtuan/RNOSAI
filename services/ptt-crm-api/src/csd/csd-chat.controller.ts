import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { CsdChatService } from './csd-chat.service';
import type {
  CsdActor,
  CsdConversationKind,
  CsdConversationListFilter,
  CreateCsdConversationInput,
  CreateCsdTicketInput,
  SendCsdMessageInput,
} from './csd.types';
import { RequireCsdAction, StaffCsdGuard } from './guards/staff-csd.guard';

type AuthedReq = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Controller('api/crm/csd')
@UseGuards(StaffOrInternalKeyGuard, StaffCsdGuard)
export class CsdChatController {
  constructor(
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

  @Get('conversations')
  @RequireCsdAction('view')
  async listConversations(
    @Req() req: AuthedReq,
    @Query('filter') filter?: CsdConversationListFilter,
    @Query('kind') kind?: CsdConversationKind,
    @Query('client_account_id') clientAccountId?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    const actor = await this.actor(req);
    return this.chat.listConversations(actor, {
      filter,
      kind,
      client_account_id: clientAccountId,
      q,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('conversations')
  @RequireCsdAction('write')
  async createConversation(@Req() req: AuthedReq, @Body() body: CreateCsdConversationInput) {
    const actor = await this.actor(req);
    return this.chat.createConversation(actor, body);
  }

  @Get('conversations/:id/messages')
  @RequireCsdAction('view')
  async listMessages(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Query('after') after?: string,
    @Query('q') q?: string,
  ) {
    const actor = await this.actor(req);
    return this.chat.listMessages(actor, id, after, q);
  }

  @Get('conversations/:id/related-tickets')
  @RequireCsdAction('view')
  async listRelatedTickets(@Req() req: AuthedReq, @Param('id') id: string) {
    const actor = await this.actor(req);
    return this.chat.listRelatedTickets(actor, id);
  }

  @Post('conversations/:id/messages')
  @RequireCsdAction('write')
  async sendMessage(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: SendCsdMessageInput,
  ) {
    const actor = await this.actor(req);
    return this.chat.sendMessage(actor, id, body);
  }

  @Post('messages/:id/create-ticket')
  @RequireCsdAction('write')
  async createTicketFromMessage(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: Partial<CreateCsdTicketInput>,
  ) {
    const actor = await this.actor(req);
    return this.chat.createTicketFromMessage(actor, id, body);
  }

  @Get('conversations/:id/members')
  @RequireCsdAction('view')
  async listMembers(@Req() req: AuthedReq, @Param('id') id: string) {
    const actor = await this.actor(req);
    return this.chat.listMembers(actor, id);
  }

  @Post('conversations/:id/members')
  @RequireCsdAction('write')
  async addMember(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: { member_staff_id: number; role?: 'owner' | 'member' | 'viewer' },
  ) {
    const actor = await this.actor(req);
    return this.chat.addMember(actor, id, body);
  }

  @Delete('conversations/:id/members/:staffId')
  @RequireCsdAction('write')
  async removeMember(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Param('staffId') staffId: string,
  ) {
    const actor = await this.actor(req);
    return this.chat.removeMember(actor, id, Number(staffId));
  }

  @Post('conversations/:id/read')
  @RequireCsdAction('view')
  async markRead(@Req() req: AuthedReq, @Param('id') id: string) {
    const actor = await this.actor(req);
    return this.chat.markRead(actor, id);
  }

  @Post('conversations/:id/close')
  @RequireCsdAction('write')
  async closeConversation(@Req() req: AuthedReq, @Param('id') id: string) {
    const actor = await this.actor(req);
    return this.chat.closeConversation(actor, id);
  }

  @Post('conversations/:id/reopen')
  @RequireCsdAction('write')
  async reopenConversation(@Req() req: AuthedReq, @Param('id') id: string) {
    const actor = await this.actor(req);
    return this.chat.reopenConversation(actor, id);
  }
}
