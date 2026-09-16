import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CsdAuditRepository } from './csd-audit.repository';
import { CsdChatAccountsService } from './csd-chat-accounts.service';
import { CsdChatFriendsService } from './csd-chat-friends.service';
import {
  canManageGroupInfo,
  canLeaveGroup,
  canManageGroupMembers,
  canPinGroupMessage,
  canRemoveGroupMember,
  canResolveJoinRequest,
  canSendInGroup,
  canSetGroupAdminRole,
  canTransferGroupOwner,
  isAssignableGroupRole,
  type CsdGroupMemberRole,
} from './csd-chat-group-admin.util';
import { parseMentions } from './csd-chat-search.util';
import { suggestPriorityFromText } from './csd-chat-keyword.util';
import { CsdChatFilesService } from './csd-chat-files.service';
import { CsdChatRepository } from './csd-chat.repository';
import { CsdTicketsService } from './csd-tickets.service';
import {
  assertStaffAvatarUpload,
  contentTypeForAvatarExt,
} from '../staff-auth/staff-avatar-image.util';
import { StaffAvatarStorage } from '../staff-auth/staff-avatar.storage';
import {
  CreateCsdConversationInput,
  CreateCsdTicketInput,
  CsdActor,
  CsdConversationKind,
  CsdConversationListItem,
  CsdConversationListQuery,
  CsdConversationMemberRow,
  CsdChatEmotionId,
  CsdConversationRow,
  CsdGroupAdminDetail,
  CsdGroupAdminListItem,
  CsdGroupJoinRequestRow,
  CsdMessageReactionSummary,
  CsdMessageRow,
  CSD_CHAT_EMOTION_IDS,
  CsdTicketFromChatMessage,
  CsdTicketRow,
  SendCsdMessageInput,
  SendCsdMessageResult,
} from './csd.types';

const EDIT_WINDOW_MS = 15 * 60_000;

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

function hasPlatformManage(actor: CsdActor): boolean {
  return hasCsdCap(actor, 'manage') || hasCsdCap(actor, 'admin');
}

function assertPlatformManage(actor: CsdActor): void {
  if (!hasPlatformManage(actor)) {
    throw new ForbiddenException({ error: 'csd_admin_forbidden' });
  }
}

@Injectable()
export class CsdChatService {
  constructor(
    private readonly repo: CsdChatRepository,
    private readonly tickets: CsdTicketsService,
    private readonly files: CsdChatFilesService,
    private readonly audit: CsdAuditRepository,
    private readonly accounts: CsdChatAccountsService,
    private readonly friends: CsdChatFriendsService,
    private readonly avatarStorage: StaffAvatarStorage,
  ) {}

  async createConversation(
    actor: CsdActor,
    input: CreateCsdConversationInput,
  ): Promise<CsdConversationRow> {
    await this.accounts.assertEnabled(actor);
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
      if (existing) {
        return (await this.repo.getConversationForMember(existing.id, actor.staffId)) ?? existing;
      }
      const ok = await this.friends.isAccepted(actor.staffId, peer);
      if (!ok) throw new ConflictException({ error: 'not_friends' });
      const name =
        String(input.name_vi ?? '').trim() ||
        (await this.repo.findStaffDisplayName(peer)) ||
        'Đồng nghiệp';
      const created = await this.repo.insertConversation({
        kind: 'direct',
        name_vi: name,
        created_by_staff_id: actor.staffId,
        extra_members: extraMembers,
      });
      return (await this.repo.getConversationForMember(created.id, actor.staffId)) ?? created;
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

  async setConversationAlias(
    actor: CsdActor,
    conversationId: string,
    aliasVi: string,
  ): Promise<CsdConversationRow> {
    await this.accounts.assertEnabled(actor);
    const alias = String(aliasVi ?? '').trim();
    if (alias.length > 191) {
      throw new BadRequestException({ error: 'alias_too_long' });
    }
    await this.requireConversation(conversationId);
    const row = await this.repo.setMemberAlias(conversationId, actor.staffId, alias);
    if (!row) throw new ForbiddenException({ error: 'csd_not_member' });
    return row;
  }

  async markRead(actor: CsdActor, conversationId: string): Promise<{ read: true }> {
    await this.requireConversation(conversationId);
    const ok = await this.repo.markRead(conversationId, actor.staffId);
    if (!ok) throw new ForbiddenException({ error: 'csd_not_member' });
    return { read: true };
  }

  async unreadConversationCount(actor: CsdActor): Promise<{ count: number }> {
    const count = await this.repo.countUnreadConversations(actor.staffId);
    return { count };
  }

  async sendMessage(
    actor: CsdActor,
    conversationId: string,
    input: SendCsdMessageInput,
  ): Promise<SendCsdMessageResult> {
    await this.accounts.assertEnabled(actor);
    const conv = await this.repo.getConversation(conversationId);
    if (!conv) throw new NotFoundException({ error: 'csd_conversation_not_found' });
    if (conv.status === 'closed' || conv.status === 'archived') {
      throw new ConflictException({ error: 'conversation_closed' });
    }
    if (conv.kind === 'announcement' && conv.owner_staff_id !== actor.staffId) {
      throw new ForbiddenException({ error: 'announcement_owner_only' });
    }
    if (conv.kind === 'group' && conv.members_can_send === false) {
      const role = await this.actorGroupRole(actor, conversationId);
      if (!canSendInGroup(role, false, hasPlatformManage(actor))) {
        throw new ForbiddenException({ error: 'members_cannot_send' });
      }
    }

    const body = String(input.body_text ?? '').trim();
    const attachmentIds = [...new Set((input.attachment_ids ?? []).map(String).filter(Boolean))];
    if (!body && attachmentIds.length === 0) {
      throw new BadRequestException({ error: 'body_required' });
    }

    const visibility =
      conv.kind === 'client' ? 'client' : (input.visibility ?? 'internal');

    const message = await this.repo.insertMessage({
      conversation_id: conversationId,
      author_staff_id: actor.staffId,
      body_text: body,
      reply_to_id: input.reply_to_id ?? null,
      visibility,
    });

    if (attachmentIds.length > 0) {
      await this.files.attachToMessage(conversationId, message.id, attachmentIds);
    }

    const mentioned = parseMentions(body).filter((id) => id !== actor.staffId);
    if (mentioned.length > 0) {
      await this.repo.insertMentionNotifications({
        conversationId,
        messageId: message.id,
        staffIds: mentioned,
        excludeStaffId: actor.staffId,
        preview: body.slice(0, 160) || '(file)',
      });
    }

    if (conv.kind === 'client') {
      const members = await this.repo.listMembers(conversationId);
      await this.repo.insertClientChatNotifications({
        conversationId,
        messageId: message.id,
        staffIds: members.map((m) => m.member_staff_id),
        excludeStaffId: actor.staffId,
        preview: body.slice(0, 160) || '(file)',
      });
    }

    const attachments = await this.files.listForMessage(message.id);
    const priority_suggestion = suggestPriorityFromText(body);
    return {
      ...message,
      attachments,
      delivery_status: message.delivery_status ?? 'sent',
      priority_suggestion,
    };
  }

  async listMessages(
    actor: CsdActor,
    conversationId: string,
    after?: string,
    q?: string,
  ): Promise<{ items: CsdMessageRow[]; me_staff_id: number }> {
    const conv = await this.repo.getConversation(conversationId);
    if (!conv) throw new NotFoundException({ error: 'csd_conversation_not_found' });
    const items = await this.repo.listMessages(conversationId, after, q);
    const ids = items.map((m) => m.id);
    const grouped = await this.repo.listAttachmentsByMessages(ids);
    const reactions = await this.repo.listReactionsByMessages(ids, actor.staffId);
    return {
      me_staff_id: actor.staffId,
      items: items.map((m) => ({
        ...m,
        attachments: grouped[m.id] ?? [],
        reactions: reactions[m.id] ?? [],
      })),
    };
  }

  async reactToMessage(
    actor: CsdActor,
    messageId: string,
    emotion: string,
  ): Promise<{ message_id: string; reactions: CsdMessageReactionSummary[] }> {
    await this.accounts.assertEnabled(actor);
    if (!CSD_CHAT_EMOTION_IDS.includes(emotion as CsdChatEmotionId)) {
      throw new BadRequestException({ error: 'emotion_invalid' });
    }
    const message = await this.repo.getMessage(messageId);
    if (!message) throw new NotFoundException({ error: 'csd_message_not_found' });
    if (message.is_deleted) throw new ConflictException({ error: 'message_deleted' });
    const conv = await this.repo.getConversation(message.conversation_id);
    if (!conv) throw new NotFoundException({ error: 'csd_conversation_not_found' });
    if (conv.status === 'closed' || conv.status === 'archived') {
      throw new ConflictException({ error: 'conversation_closed' });
    }
    const reactions = await this.repo.setMessageReaction(
      messageId,
      actor.staffId,
      emotion as CsdChatEmotionId,
    );
    return { message_id: messageId, reactions };
  }

  async listRelatedTickets(
    _actor: CsdActor,
    conversationId: string,
  ): Promise<{ items: CsdTicketRow[] }> {
    const conv = await this.requireConversation(conversationId);
    return { items: await this.repo.listRelatedTickets(conv.id) };
  }

  async listMemberAttachments(
    actor: CsdActor,
    query: { conversation_id?: string; peer_staff_id?: number; limit?: number } = {},
  ) {
    await this.accounts.assertEnabled(actor);
    const items = await this.repo.listMemberAttachments(actor.staffId, {
      conversationId: query.conversation_id,
      peerStaffId: query.peer_staff_id,
      limit: query.limit,
    });
    return { items };
  }

  async listConversationAttachments(actor: CsdActor, conversationId: string) {
    await this.requireConversation(conversationId);
    const items = await this.repo.listConversationAttachments(conversationId, actor.staffId);
    return { items };
  }

  async createTicketFromMessage(
    actor: CsdActor,
    messageId: string,
    patch: Partial<CreateCsdTicketInput> = {},
  ): Promise<CsdTicketFromChatMessage> {
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

    const existing = await this.tickets.findBySource('chat_message', messageId);
    if (existing) {
      await this.repo.linkMessageToTicket(messageId, existing.id);
      return { ...existing, skipped_internal_files: [], already_exists: true };
    }

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
    const attached = await this.files.listForMessage(messageId);
    const skipped_internal_files = attached.filter((f) => f.visibility !== 'client').map((f) => f.id);
    const clientFiles = attached.filter((f) => f.visibility === 'client');
    await this.files.copyClientFilesToTicket(clientFiles, ticket.id);
    return { ...ticket, skipped_internal_files, already_exists: false };
  }

  async forwardMessage(
    actor: CsdActor,
    targetConversationId: string,
    input: { message_id: string },
  ): Promise<CsdMessageRow> {
    const source = await this.repo.getMessage(input.message_id);
    if (!source || source.is_deleted) {
      throw new NotFoundException({ error: 'csd_message_not_found' });
    }
    const sourceConv = await this.repo.getConversation(source.conversation_id);
    if (!sourceConv) throw new NotFoundException({ error: 'csd_conversation_not_found' });

    const quote = `↪ Chuyển tiếp từ ${sourceConv.name_vi}:\n${source.body_text}`;
    return this.sendMessage(actor, targetConversationId, { body_text: quote });
  }

  async editMessage(
    actor: CsdActor,
    messageId: string,
    input: { body_text: string },
  ): Promise<CsdMessageRow> {
    const message = await this.repo.getMessage(messageId);
    if (!message) throw new NotFoundException({ error: 'csd_message_not_found' });
    if (message.author_staff_id !== actor.staffId) {
      throw new ForbiddenException({ error: 'csd_edit_forbidden' });
    }
    const conv = await this.repo.getConversation(message.conversation_id);
    if (!conv) throw new NotFoundException({ error: 'csd_conversation_not_found' });
    if (conv.status === 'closed' || conv.status === 'archived') {
      throw new ConflictException({ error: 'conversation_closed' });
    }
    const created = new Date(message.created_at).getTime();
    if (!Number.isFinite(created) || Date.now() - created > EDIT_WINDOW_MS) {
      throw new ConflictException({ error: 'edit_window_closed' });
    }
    const body = String(input.body_text ?? '').trim();
    if (!body) throw new BadRequestException({ error: 'body_required' });
    return this.repo.updateMessageBody(messageId, body);
  }

  async deleteMessage(actor: CsdActor, messageId: string): Promise<CsdMessageRow> {
    const message = await this.repo.getMessage(messageId);
    if (!message) throw new NotFoundException({ error: 'csd_message_not_found' });
    const conv = await this.repo.getConversation(message.conversation_id);
    if (!conv) throw new NotFoundException({ error: 'csd_conversation_not_found' });
    const own = message.author_staff_id === actor.staffId;
    if (!own && !canManageConversation(actor, conv.owner_staff_id)) {
      throw new ForbiddenException({ error: 'csd_delete_forbidden' });
    }
    await this.audit.insert({
      actor_staff_id: actor.staffId,
      action: 'csd_message_delete',
      entity_type: 'csd_message',
      entity_id: messageId,
      before_json: { body_text: message.body_text, conversation_id: message.conversation_id },
    });
    return this.repo.softDeleteMessage(messageId);
  }

  async listGroupsForAdmin(
    actor: CsdActor,
    query: { q?: string; limit?: number } = {},
  ): Promise<{ items: CsdGroupAdminListItem[] }> {
    assertPlatformManage(actor);
    return { items: await this.repo.listGroupsAdmin(query) };
  }

  async getGroupForAdmin(actor: CsdActor, conversationId: string): Promise<CsdGroupAdminDetail> {
    assertPlatformManage(actor);
    const conv = await this.repo.getConversation(conversationId);
    if (!conv || conv.kind !== 'group') {
      throw new NotFoundException({ error: 'csd_conversation_not_found' });
    }
    const [members, join_requests] = await Promise.all([
      this.repo.listMembers(conversationId),
      this.repo.listPendingJoinRequests(conversationId),
    ]);
    return { conversation: conv, members, join_requests };
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
  ): Promise<CsdConversationMemberRow | { pending: true; request: CsdGroupJoinRequestRow }> {
    const conv = await this.requireWritableConversation(conversationId);
    await this.assertCanManageMembers(actor, conv);
    const staffId = Number(input.member_staff_id);
    if (!Number.isInteger(staffId) || staffId <= 0) {
      throw new BadRequestException({ error: 'member_staff_id_required' });
    }
    if (conv.kind === 'group') {
      const platform = hasPlatformManage(actor);
      if (!platform) {
        const ok = await this.friends.isAccepted(actor.staffId, staffId);
        if (!ok) throw new ConflictException({ error: 'not_friends' });
      }
      const already = await this.repo.getMember(conversationId, staffId);
      if (already) return already;
      if (conv.join_approval_required && !platform) {
        const request = await this.repo.insertJoinRequest({
          conversation_id: conversationId,
          requester_staff_id: staffId,
          invited_by_staff_id: actor.staffId,
        });
        return { pending: true, request };
      }
    }
    return this.repo.insertMember({
      conversation_id: conversationId,
      member_staff_id: staffId,
      role: input.role === 'viewer' ? 'viewer' : 'member',
    });
  }

  async listJoinRequests(
    actor: CsdActor,
    conversationId: string,
  ): Promise<{ items: CsdGroupJoinRequestRow[] }> {
    const conv = await this.requireConversation(conversationId);
    if (conv.kind !== 'group') throw new BadRequestException({ error: 'group_only' });
    await this.assertCanManageMembers(actor, conv);
    return { items: await this.repo.listPendingJoinRequests(conversationId) };
  }

  async approveJoinRequest(
    actor: CsdActor,
    conversationId: string,
    requestId: string,
  ): Promise<{ member: CsdConversationMemberRow; request: CsdGroupJoinRequestRow }> {
    const conv = await this.requireWritableConversation(conversationId);
    if (conv.kind !== 'group') throw new BadRequestException({ error: 'group_only' });
    const actorRole = await this.actorGroupRole(actor, conversationId);
    if (!canResolveJoinRequest(actorRole, hasPlatformManage(actor))) {
      throw new ForbiddenException({ error: 'csd_join_forbidden' });
    }
    const pending = await this.repo.getJoinRequest(conversationId, requestId);
    if (!pending || pending.status !== 'pending') {
      throw new NotFoundException({ error: 'csd_join_request_not_found' });
    }
    const member = await this.repo.insertMember({
      conversation_id: conversationId,
      member_staff_id: pending.requester_staff_id,
      role: 'member',
    });
    const request = await this.repo.resolveJoinRequest(
      conversationId,
      requestId,
      'approved',
      actor.staffId,
    );
    return { member, request };
  }

  async rejectJoinRequest(
    actor: CsdActor,
    conversationId: string,
    requestId: string,
  ): Promise<{ request: CsdGroupJoinRequestRow }> {
    const conv = await this.requireWritableConversation(conversationId);
    if (conv.kind !== 'group') throw new BadRequestException({ error: 'group_only' });
    const actorRole = await this.actorGroupRole(actor, conversationId);
    if (!canResolveJoinRequest(actorRole, hasPlatformManage(actor))) {
      throw new ForbiddenException({ error: 'csd_join_forbidden' });
    }
    const request = await this.repo.resolveJoinRequest(
      conversationId,
      requestId,
      'rejected',
      actor.staffId,
    );
    return { request };
  }

  async pinMessage(actor: CsdActor, messageId: string): Promise<CsdConversationRow> {
    const message = await this.repo.getMessage(messageId);
    if (!message || message.is_deleted) {
      throw new NotFoundException({ error: 'csd_message_not_found' });
    }
    const conv = await this.requireWritableConversation(message.conversation_id);
    if (conv.kind !== 'group') throw new BadRequestException({ error: 'group_only' });
    const actorRole = await this.actorGroupRole(actor, conv.id);
    if (!canPinGroupMessage(actorRole, hasPlatformManage(actor))) {
      throw new ForbiddenException({ error: 'csd_pin_forbidden' });
    }
    const row = await this.repo.setPinnedMessage(conv.id, messageId, actor.staffId);
    return this.conversationView(actor, conv.id, row);
  }

  async unpinConversation(actor: CsdActor, conversationId: string): Promise<CsdConversationRow> {
    const conv = await this.requireWritableConversation(conversationId);
    if (conv.kind !== 'group') throw new BadRequestException({ error: 'group_only' });
    const actorRole = await this.actorGroupRole(actor, conversationId);
    if (!canPinGroupMessage(actorRole, hasPlatformManage(actor))) {
      throw new ForbiddenException({ error: 'csd_pin_forbidden' });
    }
    const row = await this.repo.setPinnedMessage(conversationId, null, actor.staffId);
    return this.conversationView(actor, conversationId, row);
  }

  async transferOwner(
    actor: CsdActor,
    conversationId: string,
    newOwnerStaffId: number,
  ): Promise<CsdConversationRow> {
    const conv = await this.requireWritableConversation(conversationId);
    if (conv.kind !== 'group') throw new BadRequestException({ error: 'group_only' });
    const actorRole = await this.actorGroupRole(actor, conversationId);
    if (!canTransferGroupOwner(actorRole, hasPlatformManage(actor))) {
      throw new ForbiddenException({ error: 'csd_transfer_forbidden' });
    }
    const toId = Number(newOwnerStaffId);
    if (!Number.isInteger(toId) || toId <= 0) {
      throw new BadRequestException({ error: 'new_owner_staff_id_required' });
    }
    if (toId === actor.staffId && actorRole === 'owner') {
      throw new BadRequestException({ error: 'cannot_transfer_to_self' });
    }
    const fromId = conv.owner_staff_id ?? actor.staffId;
    if (toId === fromId) {
      throw new BadRequestException({ error: 'cannot_transfer_to_self' });
    }
    const row = await this.repo.transferOwner(conversationId, fromId, toId);
    return this.conversationView(actor, conversationId, row);
  }

  async removeMember(
    actor: CsdActor,
    conversationId: string,
    memberStaffId: number,
  ): Promise<{ removed: true }> {
    const conv = await this.requireWritableConversation(conversationId);
    if (conv.kind === 'group') {
      const actorRole = await this.actorGroupRole(actor, conversationId);
      const target = await this.repo.getMember(conversationId, memberStaffId);
      if (!target) throw new NotFoundException({ error: 'csd_member_not_found' });
      if (memberStaffId === actor.staffId) {
        if (!canLeaveGroup(actorRole)) {
          throw new ForbiddenException({ error: 'csd_leave_forbidden' });
        }
      } else if (
        !canRemoveGroupMember(
          actorRole,
          target.role as CsdGroupMemberRole,
          hasPlatformManage(actor),
        )
      ) {
        throw new ForbiddenException({ error: 'csd_member_forbidden' });
      }
    } else {
      if (!canManageConversation(actor, conv.owner_staff_id)) {
        throw new ForbiddenException({ error: 'csd_member_forbidden' });
      }
      if (conv.owner_staff_id === memberStaffId) {
        throw new BadRequestException({ error: 'cannot_remove_owner' });
      }
    }
    const removed = await this.repo.deleteMember(conversationId, memberStaffId);
    if (!removed) throw new NotFoundException({ error: 'csd_member_not_found' });
    return { removed: true };
  }

  async setMemberRole(
    actor: CsdActor,
    conversationId: string,
    memberStaffId: number,
    roleRaw: string,
  ): Promise<CsdConversationMemberRow> {
    const conv = await this.requireWritableConversation(conversationId);
    if (conv.kind !== 'group') {
      throw new BadRequestException({ error: 'group_only' });
    }
    if (!isAssignableGroupRole(roleRaw)) {
      throw new BadRequestException({ error: 'invalid_role' });
    }
    const actorRole = await this.actorGroupRole(actor, conversationId);
    if (!canSetGroupAdminRole(actorRole, hasPlatformManage(actor))) {
      throw new ForbiddenException({ error: 'csd_role_forbidden' });
    }
    const target = await this.repo.getMember(conversationId, memberStaffId);
    if (!target) throw new NotFoundException({ error: 'csd_member_not_found' });
    if (target.role === 'owner') {
      throw new BadRequestException({ error: 'cannot_change_owner_role' });
    }
    return this.repo.updateMemberRole(conversationId, memberStaffId, roleRaw);
  }

  async patchConversation(
    actor: CsdActor,
    conversationId: string,
    input: {
      name_vi?: string;
      description?: string;
      clear_avatar?: boolean;
      join_approval_required?: boolean;
      members_can_send?: boolean;
    },
  ): Promise<CsdConversationRow> {
    const conv = await this.requireWritableConversation(conversationId);
    if (conv.kind !== 'group') {
      throw new BadRequestException({ error: 'group_only' });
    }
    await this.assertCanManageGroupInfo(actor, conv);

    const patch: {
      name_vi?: string;
      description?: string;
      join_approval_required?: boolean;
      members_can_send?: boolean;
    } = {};
    if (input.name_vi != null) {
      const name = String(input.name_vi).trim();
      if (!name) throw new BadRequestException({ error: 'name_required' });
      if (name.length > 191) throw new BadRequestException({ error: 'name_too_long' });
      patch.name_vi = name;
    }
    if (input.description != null) {
      patch.description = String(input.description);
    }
    if (input.join_approval_required != null) {
      patch.join_approval_required = Boolean(input.join_approval_required);
    }
    if (input.members_can_send != null) {
      patch.members_can_send = Boolean(input.members_can_send);
    }

    let row = conv;
    if (
      patch.name_vi != null ||
      patch.description != null ||
      patch.join_approval_required != null ||
      patch.members_can_send != null
    ) {
      row = await this.repo.updateConversationInfo(conversationId, patch, actor.staffId);
    }
    if (input.clear_avatar) {
      row = await this.clearGroupAvatar(actor, conversationId);
    }
    return this.conversationView(actor, conversationId, row);
  }

  async uploadGroupAvatar(
    actor: CsdActor,
    conversationId: string,
    file?: Express.Multer.File,
  ): Promise<CsdConversationRow> {
    const conv = await this.requireWritableConversation(conversationId);
    if (conv.kind !== 'group') {
      throw new BadRequestException({ error: 'group_only' });
    }
    await this.assertCanManageGroupInfo(actor, conv);
    if (!file?.buffer?.length) {
      throw new BadRequestException({ error: 'file_required' });
    }
    try {
      assertStaffAvatarUpload({
        buffer: file.buffer,
        mimetype: file.mimetype,
        size: file.size,
      });
    } catch (err) {
      const code = err instanceof Error ? err.message : 'invalid_image';
      throw new BadRequestException({ error: code });
    }

    const oldKey = await this.repo.getGroupAvatarStorageKey(conversationId);
    const { storageKey } = this.avatarStorage.save(`group-${conversationId}`, file.buffer, file.mimetype);
    const row = await this.repo.setGroupAvatarStorageKey(conversationId, storageKey, actor.staffId);
    if (oldKey && oldKey !== storageKey) {
      this.avatarStorage.remove(oldKey);
    }
    return this.conversationView(actor, conversationId, row);
  }

  async clearGroupAvatar(actor: CsdActor, conversationId: string): Promise<CsdConversationRow> {
    const conv = await this.requireWritableConversation(conversationId);
    if (conv.kind !== 'group') {
      throw new BadRequestException({ error: 'group_only' });
    }
    await this.assertCanManageGroupInfo(actor, conv);
    const oldKey = await this.repo.getGroupAvatarStorageKey(conversationId);
    const row = await this.repo.setGroupAvatarStorageKey(conversationId, null, actor.staffId);
    if (oldKey) this.avatarStorage.remove(oldKey);
    return this.conversationView(actor, conversationId, row);
  }

  async readGroupAvatar(
    conversationId: string,
  ): Promise<{ buffer: Buffer; contentType: string } | null> {
    const key = await this.repo.getGroupAvatarStorageKey(conversationId);
    if (!key) return null;
    const buffer = this.avatarStorage.read(key);
    if (!buffer) return null;
    const ext = String(key).split('.').pop() ?? 'jpg';
    return { buffer, contentType: contentTypeForAvatarExt(ext) };
  }

  async closeConversation(actor: CsdActor, conversationId: string): Promise<CsdConversationRow> {
    const conv = await this.requireConversation(conversationId);
    if (!canManageConversation(actor, conv.owner_staff_id)) {
      throw new ForbiddenException({ error: 'csd_close_forbidden' });
    }
    return this.repo.updateStatus(conversationId, 'closed', actor.staffId);
  }

  async archiveConversation(actor: CsdActor, conversationId: string): Promise<CsdConversationRow> {
    const conv = await this.requireConversation(conversationId);
    if (!canManageConversation(actor, conv.owner_staff_id)) {
      throw new ForbiddenException({ error: 'csd_archive_forbidden' });
    }
    return this.repo.updateStatus(conversationId, 'archived', actor.staffId);
  }

  async reopenConversation(actor: CsdActor, conversationId: string): Promise<CsdConversationRow> {
    const conv = await this.requireConversation(conversationId);
    if (!canManageConversation(actor, conv.owner_staff_id)) {
      throw new ForbiddenException({ error: 'csd_reopen_forbidden' });
    }
    return this.repo.updateStatus(conversationId, 'reopened', actor.staffId);
  }

  private async actorGroupRole(
    actor: CsdActor,
    conversationId: string,
  ): Promise<CsdGroupMemberRole | null> {
    const member = await this.repo.getMember(conversationId, actor.staffId);
    return (member?.role as CsdGroupMemberRole | undefined) ?? null;
  }

  private async conversationView(
    actor: CsdActor,
    conversationId: string,
    fallback: CsdConversationRow,
  ): Promise<CsdConversationRow> {
    return (
      (await this.repo.getConversationForMember(conversationId, actor.staffId)) ??
      (await this.repo.getConversation(conversationId)) ??
      fallback
    );
  }

  private async assertCanManageMembers(actor: CsdActor, conv: CsdConversationRow): Promise<void> {
    if (conv.kind === 'group') {
      const role = await this.actorGroupRole(actor, conv.id);
      if (!canManageGroupMembers(role, hasPlatformManage(actor))) {
        throw new ForbiddenException({ error: 'csd_member_forbidden' });
      }
      return;
    }
    if (!canManageConversation(actor, conv.owner_staff_id)) {
      throw new ForbiddenException({ error: 'csd_member_forbidden' });
    }
  }

  private async assertCanManageGroupInfo(actor: CsdActor, conv: CsdConversationRow): Promise<void> {
    const role = await this.actorGroupRole(actor, conv.id);
    if (!canManageGroupInfo(role, hasPlatformManage(actor))) {
      throw new ForbiddenException({ error: 'csd_group_forbidden' });
    }
  }

  private async requireConversation(conversationId: string): Promise<CsdConversationRow> {
    const conv = await this.repo.getConversation(conversationId);
    if (!conv) throw new NotFoundException({ error: 'csd_conversation_not_found' });
    return conv;
  }

  private async requireWritableConversation(conversationId: string): Promise<CsdConversationRow> {
    const conv = await this.requireConversation(conversationId);
    if (conv.status === 'closed' || conv.status === 'archived') {
      throw new ConflictException({ error: 'conversation_closed' });
    }
    return conv;
  }
}
