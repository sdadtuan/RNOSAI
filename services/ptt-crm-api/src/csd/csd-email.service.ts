import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { CsdEmailRepository } from './csd-email.repository';
import {
  isIgnorableInbound,
  needsEmailApproval,
  parseTicketCodeFromSubject,
} from './csd-email-match.util';
import { CsdTicketsService } from './csd-tickets.service';
import {
  CsdActor,
  CsdEmailRow,
  InboundCsdEmailInput,
  SendCsdEmailInput,
} from './csd.types';

const DEFAULT_FROM = 'support@agency.ptt.vn';

function hasCsdManage(caps: { section: string; action: string }[]): boolean {
  const order = ['view', 'write', 'assign', 'manage', 'admin'];
  const manageIdx = order.indexOf('manage');
  for (const cap of caps) {
    if (cap.section !== 'csd') continue;
    const idx = order.indexOf(cap.action);
    if (idx >= manageIdx) return true;
  }
  return false;
}

@Injectable()
export class CsdEmailService {
  private readonly logger = new Logger(CsdEmailService.name);

  constructor(
    private readonly repo: CsdEmailRepository,
    private readonly tickets: CsdTicketsService,
    private readonly config: AppConfigService,
  ) {}

  async listUnmatched(_actor: CsdActor, limit?: number): Promise<{ items: CsdEmailRow[] }> {
    const items = await this.repo.listUnmatched(limit);
    return { items };
  }

  async processInbound(input: InboundCsdEmailInput, actorStaffId = 0): Promise<CsdEmailRow> {
    if (isIgnorableInbound(input.headers ?? {})) {
      return this.repo.insertInbound({
        provider_message_id: input.provider_message_id,
        from_address: input.from_address,
        to_json: input.to_json,
        subject: input.subject,
        body_text: input.body_text,
        body_html: input.body_html,
        ignored: true,
      });
    }

    const existing = await this.repo.findByProviderMessageId(input.provider_message_id);
    if (existing) return existing;

    const ticketCode = parseTicketCodeFromSubject(input.subject);
    let ticketId: string | null = null;
    let matchedClient: string | null = null;

    if (ticketCode) {
      const ticket = await this.repo.findTicketByCode(ticketCode);
      if (ticket) {
        ticketId = ticket.id;
        matchedClient = ticket.client_account_id;
      }
    }

    if (!ticketId) {
      const ticket = await this.tickets.create(actorStaffId, {
        title: input.subject.slice(0, 255) || 'Email inbound',
        description: input.body_text,
        ticket_type: 'email',
        priority: 'P3',
        source_type: 'email',
        source_id: input.provider_message_id,
      });
      ticketId = ticket.id;
      matchedClient = ticket.client_account_id;
    }

    return this.repo.insertInbound({
      provider_message_id: input.provider_message_id,
      from_address: input.from_address,
      to_json: input.to_json,
      subject: input.subject,
      body_text: input.body_text,
      body_html: input.body_html,
      matched_client_account_id: matchedClient,
      ticket_id: ticketId,
    });
  }

  async send(actor: CsdActor, input: SendCsdEmailInput): Promise<CsdEmailRow & { approval_id?: string }> {
    const to = (input.to ?? []).map((v) => String(v).trim()).filter(Boolean);
    const subject = String(input.subject ?? '').trim();
    const bodyText = String(input.body_text ?? '').trim();

    if (!to.length) throw new BadRequestException({ error: 'to_required' });
    if (!subject) throw new BadRequestException({ error: 'subject_required' });
    if (!bodyText) throw new BadRequestException({ error: 'body_required' });

    const requiresApproval = needsEmailApproval(subject, bodyText);
    const canBypass = hasCsdManage(actor.caps);

    const draft = await this.repo.insertOutbound({
      from_address: DEFAULT_FROM,
      to_json: to,
      subject,
      body_text: bodyText,
      body_html: input.body_html,
      send_status: requiresApproval && !canBypass ? 'draft' : 'queued',
      ticket_id: input.ticket_id ?? null,
      created_by_staff_id: actor.staffId,
    });

    if (requiresApproval && !canBypass) {
      const approval = await this.repo.insertApproval({
        entity_id: draft.id,
        requester_staff_id: actor.staffId,
        comment: subject,
      });
      return { ...draft, approval_id: approval.id };
    }

    if (!this.config.emailSendEnabled) {
      this.logger.warn('email send disabled — leaving outbound queued');
      return draft;
    }

    return this.repo.markSent(draft.id);
  }
}
