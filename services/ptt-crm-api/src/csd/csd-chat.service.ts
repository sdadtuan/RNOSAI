import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { parseMentions } from './csd-chat-search.util';
import { CsdChatRepository } from './csd-chat.repository';
import { CsdTicketsService } from './csd-tickets.service';
import {
  CreateCsdConversationInput,
  CreateCsdTicketInput,
  CsdActor,
  CsdConversationKind,
  CsdConversationListItem,
  CsdConversationListQuery,
  CsdConversationMemberRow,
  CsdConversationRow,
  CsdMessageRow,
  CsdTicketRow,
  SendCsdMessageInput,
} from './csd.types';

const CSD_KIND_NOT_MVP: CsdConversationKind[] = ['ticket', 'campaign', 'ai_assist'];

function uniqueStaffIds(ids: number[] | undefined, exclude: number): number[] {
  const seen = new Set<number>();
  for (const raw of ids ?? []) {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0 || id === exclude || seen.has(id)) continue;
    seen.add(id);
  }
  return [...seen];
}

function hasCsdCap(actor: CsdActor, action: string): boolean {
  return actor.caps.some((c) => c.section === 'csd' && c.action === action);
}

function canManageConversation(actor: CsdActor, ownerStaffId: number | null): boolean {
  if (ownerStaffId != null && ownerStaffId === actor.staffId) return true;
  return hasCsdCap(actor, 'manage') || hasCsdCap(actor, 'admin');
}

@Injectable()
export class CsdChatService {
  constructor(
    private readonly repo: CsdChatRepository,
    private readonly tickets: CsdTicketsService,
  ) {}

  async createConversation(
    actor: CsdActor,
    input: CreateCsdConversationInput,
  ): Promise<CsdConversationRow> {
    if (CSD_KIND_NOT_MVP.includes(input.kind)) {
      throw new BadRequestException({ error: 'kind_not_mvp' });
    }

    const extraIds = uniqueStaffIds(input.member_staff_ids, actor.staffId);
    const memberRole = input.kind === 'announcement' ? 'viewer' : 'member';
    const extraMembers = extraIds.map((staff_id) => ({ staff_id, role: memberRole as 'member' | 'viewer' }));

    if (input.kind === 'direct') {
      if (extraIds.length !== 1) {
        throw new BadRequestException({ error: 'peer_required' });
      }
      const peer = extraIds[0];
      const existing = await this.repo.findDirectPair(actor.staffId, peer);
      if (existing) return existing;
      const name = String(input.name_vi ?? '').trim() || `DM · #${peer}`;
      return this.repo.insertConversation({
        kind: 'direct',
        name_vi: name,
        created_by_staff_id: actor.staffId,
        extra_members: extraMembers,
      });
    }

    const name = String(input.name_vi ?? '').trim();
    if (!name) {
      throw new BadRequestException({ error: 'name_required' });
    }
    if (input.kind === 'group' && extraIds.length < 1) {
      throw new BadRequestException({ error: 'members_required' });
    }
    if (input.kind === 'client' && !input.client_account_id) {
      throw new BadRequestException({ error: 'client_account_id_required' });
    }
    if (input.kind === 'project' && (!input.project_ref_kind || !input.project_ref_id)) {
      throw new BadRequestException({ error: 'project_ref_required' });
    }

    return this.repo.insertConversation({
      kind: input.kind,
      name_vi: name,
      client_account_id: input.client_account_id ?? null,
      project_ref_kind: input.project_ref_kind ?? null,
      project_ref_id: input.project_ref_id ?? null,
      created_by_staff_id: actor.staffId,
      extra_members: extraMembers,
    });
  }

  async listConversations(
    actor: CsdActor,
    query: CsdConversationListQuery,
  ): Promise<{ items: CsdConversationListItem[] }> {
    const items = await this.repo.listConversationsForMember({
      staffId: actor.staffId,
      filter: query.filter ?? 'all',
      kind: query.kind,
      client_account_id: query.client_account_id,
      q: query.q,
      limit: query.limit,
    });
    return { items };
  }

  async markRead(actor: CsdActor, conversationId: string): Promise<{ read: true }> {
    await this.requireConversation(conversationId);
    const ok = await this.repo.markRead(conversationId, actor.staffId);
    if (!ok) throw new ForbiddenException({ error: 'csd_not_member' });
    return { read: true };
  }

  async sendMessage(
    actor: CsdActor,
    conversationId: string,
    input: SendCsdMessageInput,
  ): Promise<CsdMessageRow> {
    const conv = await this.repo.getConversation(conversationId);
    if (!conv) throw new NotFoundException({ error: 'csd_conversation_not_found' });
    if (conv.status === 'closed') {
      throw new ConflictException({ error: 'conversation_closed' });
    }
    if (conv.kind === 'announcement' && conv.owner_staff_id !== actor.staffId) {
      throw new ForbiddenException({ error: 'announcement_owner_only' });
    }

    const body = String(input.body_text ?? '').trim();
    if (!body) throw new BadRequestException({ error: 'body_required' });

    const visibility =
      conv.kind === 'client' ? 'client' : (input.visibility ?? 'internal');

    const message = await this.repo.insertMessage({
      conversation_id: conversationId,
      author_staff_id: actor.staffId,
      body_text: body,
      reply_to_id: input.reply_to_id ?? null,
      visibility,
    });

    const mentioned = parseMentions(body).filter((id) => id !== actor.staffId);
    if (mentioned.length > 0) {
      await this.repo.insertMentionNotifications({
        conversationId,
        messageId: message.id,
        staffIds: mentioned,
        excludeStaffId: actor.staffId,
        preview: body.slice(0, 160),
      });
    }
    return message;
  }

  async listMessages(
    _actor: CsdActor,
    conversationId: string,
    after?: string,
    q?: string,
  ): Promise<{ items: CsdMessageRow[] }> {
    const conv = await this.repo.getConversation(conversationId);
    if (!conv) throw new NotFoundException({ error: 'csd_conversation_not_found' });
    const items = await this.repo.listMessages(conversationId, after, q);
    return { items };
  }

  async listRelatedTickets(
    _actor: CsdActor,
    conversationId: string,
  ): Promise<{ items: CsdTicketRow[] }> {
    const conv = await this.requireConversation(conversationId);
    return { items: await this.repo.listRelatedTickets(conv.id) };
  }

  async createTicketFromMessage(
    actor: CsdActor,
    messageId: string,
    patch: Partial<CreateCsdTicketInput> = {},
  ): Promise<CsdTicketRow> {
    const message = await this.repo.getMessage(messageId);
    if (!message) throw new NotFoundException({ error: 'csd_message_not_found' });

    const conv = await this.repo.getConversation(message.conversation_id);
    if (!conv) throw new NotFoundException({ error: 'csd_conversation_not_found' });
    if (conv.kind === 'announcement') {
      throw new BadRequestException({ error: 'ticket_not_allowed' });
    }

    const title =
      String(patch.title ?? '').trim() ||
      message.body_text.slice(0, 255).trim() ||
      'Ticket từ chat';

    const ticket = await this.tickets.create(actor.staffId, {
      title,
      description: patch.description ?? message.body_text,
      ticket_type: patch.ticket_type ?? 'incident',
      priority: patch.priority ?? 'P3',
      client_account_id: patch.client_account_id ?? conv.client_account_id ?? undefined,
      source_type: 'chat_message',
      source_id: message.id,
      assignee_staff_id: patch.assignee_staff_id,
    });

    await this.repo.linkMessageToTicket(messageId, ticket.id);
    return ticket;
  }

  async listMembers(
    _actor: CsdActor,
    conversationId: string,
  ): Promise<{ items: CsdConversationMemberRow[] }> {
    const conv = await this.repo.getConversation(conversationId);
    if (!conv) throw new NotFoundException({ error: 'csd_conversation_not_found' });
    return { items: await this.repo.listMembers(conversationId) };
  }

  async addMember(
    actor: CsdActor,
    conversationId: string,
    input: { member_staff_id: number; role?: CsdConversationMemberRow['role'] },
  ): Promise<CsdConversationMemberRow> {
    const conv = await this.requireWritableConversation(conversationId);
    if (!canManageConversation(actor, conv.owner_staff_id)) {
      throw new ForbiddenException({ error: 'csd_member_forbidden' });
    }
    const staffId = Number(input.member_staff_id);
    if (!Number.isInteger(staffId) || staffId <= 0) {
      throw new BadRequestException({ error: 'member_staff_id_required' });
    }
    return this.repo.insertMember({
      conversation_id: conversationId,
      member_staff_id: staffId,
      role: input.role === 'viewer' ? 'viewer' : 'member',
    });
  }

  async removeMember(
    actor: CsdActor,
    conversationId: string,
    memberStaffId: number,
  ): Promise<{ removed: true }> {
    const conv = await this.requireWritableConversation(conversationId);
    if (!canManageConversation(actor, conv.owner_staff_id)) {
      throw new ForbiddenException({ error: 'csd_member_forbidden' });
    }
    if (conv.owner_staff_id === memberStaffId) {
      throw new BadRequestException({ error: 'cannot_remove_owner' });
    }
    const removed = await this.repo.deleteMember(conversationId, memberStaffId);
    if (!removed) throw new NotFoundException({ error: 'csd_member_not_found' });
    return { removed: true };
  }

  async closeConversation(actor: CsdActor, conversationId: string): Promise<CsdConversationRow> {
    const conv = await this.requireConversation(conversationId);
    if (!canManageConversation(actor, conv.owner_staff_id)) {
      throw new ForbiddenException({ error: 'csd_close_forbidden' });
    }
    return this.repo.updateStatus(conversationId, 'closed', actor.staffId);
  }

  async reopenConversation(actor: CsdActor, conversationId: string): Promise<CsdConversationRow> {
    const conv = await this.requireConversation(conversationId);
    if (!canManageConversation(actor, conv.owner_staff_id)) {
      throw new ForbiddenException({ error: 'csd_reopen_forbidden' });
    }
    return this.repo.updateStatus(conversationId, 'reopened', actor.staffId);
  }

  private async requireConversation(conversationId: string): Promise<CsdConversationRow> {
    const conv = await this.repo.getConversation(conversationId);
    if (!conv) throw new NotFoundException({ error: 'csd_conversation_not_found' });
    return conv;
  }

  private async requireWritableConversation(conversationId: string): Promise<CsdConversationRow> {
    const conv = await this.requireConversation(conversationId);
    if (conv.status === 'closed') {
      throw new ConflictException({ error: 'conversation_closed' });
    }
    return conv;
  }
}
