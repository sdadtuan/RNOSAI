import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CsdChatRepository } from './csd-chat.repository';
import { CsdTicketsService } from './csd-tickets.service';
import {
  CreateCsdConversationInput,
  CreateCsdTicketInput,
  CsdActor,
  CsdConversationRow,
  CsdMessageRow,
  CsdTicketRow,
  SendCsdMessageInput,
} from './csd.types';

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
    const name = String(input.name_vi ?? '').trim();
    if (!name) {
      throw new BadRequestException({ error: 'name_required' });
    }
    if (input.kind === 'client' && !input.client_account_id) {
      throw new BadRequestException({ error: 'client_account_id_required' });
    }

    return this.repo.insertConversation({
      kind: input.kind,
      name_vi: name,
      client_account_id: input.client_account_id ?? null,
      project_ref_kind: input.project_ref_kind ?? null,
      project_ref_id: input.project_ref_id ?? null,
      created_by_staff_id: actor.staffId,
    });
  }

  async listConversations(
    _actor: CsdActor,
    query: { kind?: CreateCsdConversationInput['kind']; client_account_id?: string; limit?: number },
  ): Promise<{ items: CsdConversationRow[] }> {
    const items = await this.repo.listConversations(query);
    return { items };
  }

  async sendMessage(
    actor: CsdActor,
    conversationId: string,
    input: SendCsdMessageInput,
  ): Promise<CsdMessageRow> {
    const conv = await this.repo.getConversation(conversationId);
    if (!conv) throw new NotFoundException({ error: 'csd_conversation_not_found' });

    const body = String(input.body_text ?? '').trim();
    if (!body) throw new BadRequestException({ error: 'body_required' });

    const visibility =
      conv.kind === 'client' ? 'client' : (input.visibility ?? 'internal');

    return this.repo.insertMessage({
      conversation_id: conversationId,
      author_staff_id: actor.staffId,
      body_text: body,
      reply_to_id: input.reply_to_id ?? null,
      visibility,
    });
  }

  async listMessages(
    _actor: CsdActor,
    conversationId: string,
    after?: string,
  ): Promise<{ items: CsdMessageRow[] }> {
    const conv = await this.repo.getConversation(conversationId);
    if (!conv) throw new NotFoundException({ error: 'csd_conversation_not_found' });
    const items = await this.repo.listMessages(conversationId, after);
    return { items };
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
}
