import { Injectable, NotFoundException } from '@nestjs/common';
import { CsdAiRepository } from './csd-ai.repository';
import { CsdChatRepository } from './csd-chat.repository';
import { CsdTicketsRepository } from './csd-tickets.repository';

function llmEnabled(): boolean {
  return process.env.PTT_CSD_LLM === '1';
}

@Injectable()
export class CsdAiService {
  constructor(
    private readonly aiRepo: CsdAiRepository,
    private readonly ticketsRepo: CsdTicketsRepository,
    private readonly chatRepo: CsdChatRepository,
  ) {}

  async summarizeChat(
    actorStaffId: number,
    conversationId: string,
    period: '24h' | '7d' | 'all' = '24h',
  ): Promise<{ summary: string; decisions: string[]; actions: string[]; risks: string[] }> {
    const messages = await this.chatRepo.listMessages(conversationId);
    const snippet = messages
      .slice(-8)
      .map((m) => m.body_text.trim())
      .filter(Boolean)
      .join(' · ');

    const output = llmEnabled()
      ? {
          summary: `Tóm tắt hội thoại (${period}): ${snippet || 'Chưa có tin nhắn.'}`,
          decisions: ['Chưa có quyết định được ghi nhận.'],
          actions: ['Theo dõi phản hồi khách trong 24h.'],
          risks: [],
        }
      : {
          summary: snippet
            ? `Trong ${period === 'all' ? 'toàn bộ' : period}, khách/staff trao đổi: ${snippet.slice(0, 280)}`
            : 'Chưa có tin nhắn để tóm tắt.',
          decisions: [],
          actions: snippet ? ['Xác nhận lại yêu cầu với khách trước khi cam kết.'] : [],
          risks: snippet.includes('khiếu nại') ? ['Có dấu hiệu khiếu nại — cần PM/AM xem xét.'] : [],
        };

    await this.aiRepo.insert({
      actor_staff_id: actorStaffId,
      feature: 'chat_summarize',
      context_json: { conversation_id: conversationId, period },
      output_text: output.summary,
    });

    return output;
  }

  async classifyTicket(
    actorStaffId: number,
    ticketId: string,
  ): Promise<{ ticket_type: string; priority: string; tags: string[] }> {
    const ticket = await this.ticketsRepo.get(ticketId);
    if (!ticket) throw new NotFoundException({ error: 'csd_ticket_not_found' });
    const suggestion = {
      ticket_type: ticket.ticket_type || 'incident',
      priority: ticket.priority,
      tags: ticket.title.toLowerCase().includes('báo cáo') ? ['reporting'] : ['general'],
    };

    await this.aiRepo.insert({
      actor_staff_id: actorStaffId,
      feature: 'ticket_classify',
      context_json: { ticket_id: ticketId, title: ticket.title },
      output_text: JSON.stringify(suggestion),
    });

    return suggestion;
  }

  async draftReply(actorStaffId: number, ticketId: string): Promise<{ body_text: string }> {
    const ticket = await this.ticketsRepo.get(ticketId);
    if (!ticket) throw new NotFoundException({ error: 'csd_ticket_not_found' });
    const comments = await this.ticketsRepo.listComments(ticketId);
    const lastPublic = [...comments].reverse().find((c) => c.visibility === 'public');

    const body_text = llmEnabled()
      ? `Xin chào,\n\nCảm ơn bạn đã liên hệ về "${ticket.title}". Chúng tôi đang xử lý và sẽ cập nhật sớm.\n\nTrân trọng,\nAgency PTT`
      : `Xin chào,\n\nCảm ơn bạn đã phản hồi${lastPublic ? '' : ` về ticket ${ticket.code}`}. `
          + `Chúng tôi đã ghi nhận "${ticket.title}" và sẽ cập nhật tiến độ trong giờ làm việc.\n\n`
          + `Mã ticket: ${ticket.code}\nTrân trọng,\nAgency PTT`;

    await this.aiRepo.insert({
      actor_staff_id: actorStaffId,
      feature: 'ticket_draft_reply',
      context_json: { ticket_id: ticketId },
      output_text: body_text,
    });

    return { body_text };
  }
}
