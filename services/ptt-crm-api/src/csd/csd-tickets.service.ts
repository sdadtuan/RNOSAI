import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { addBusinessMinutes, policySliceFromRow } from './csd-sla.util';
import { canStartWork, canTransitionTicket } from './csd-ticket-status.util';
import { assertPublicAttachment } from './csd-visibility.util';
import { CsdAuditRepository } from './csd-audit.repository';
import { CsdTicketsRepository } from './csd-tickets.repository';
import {
  CreateCsdTicketInput,
  CsdTicketCommentRow,
  CsdTicketListQuery,
  CsdTicketRow,
  CsdTicketStatus,
} from './csd.types';

function scopeApproved(ticket: CsdTicketRow): boolean {
  if (ticket.scope_status === 'billable' || ticket.scope_status === 'included_by_exception') {
    return false;
  }
  return true;
}

@Injectable()
export class CsdTicketsService {
  constructor(
    private readonly repo: CsdTicketsRepository,
    private readonly audit: CsdAuditRepository,
  ) {}

  async create(actorStaffId: number, input: CreateCsdTicketInput): Promise<CsdTicketRow> {
    const title = String(input.title ?? '').trim();
    if (!title) {
      throw new BadRequestException({ error: 'title_required' });
    }

    if (input.idempotency_key) {
      const existingByKey = await this.repo.findByIdempotencyKey(input.idempotency_key);
      if (existingByKey) return existingByKey;
    }

    const sourceType = input.source_type ?? 'manual';
    const sourceId = input.source_id ?? null;
    if (sourceId) {
      const existingBySource = await this.repo.findBySource(sourceType, sourceId);
      if (existingBySource) return existingBySource;
    }

    const policyBundle = await this.repo.getDefaultSlaPolicy();
    const target =
      policyBundle.targets.find((t) => t.priority === input.priority) ??
      policyBundle.targets.find((t) => t.priority === 'P3');
    if (!target) {
      throw new ConflictException({ error: 'csd_sla_target_missing' });
    }

    const slice = policySliceFromRow(policyBundle);
    const now = new Date();
    const slaResponseDue = addBusinessMinutes(now, target.response_minutes, slice);
    const slaResolutionDue = addBusinessMinutes(now, target.resolution_minutes, slice);
    const code = await this.repo.nextTicketCode();

    const status: CsdTicketStatus = input.assignee_staff_id ? 'assigned' : 'new';
    const ticket = await this.repo.insert(
      {
        code,
        title,
        description: String(input.description ?? '').trim(),
        ticket_type: input.ticket_type,
        priority: input.priority,
        status,
        source_type: sourceType,
        source_id: sourceId,
        client_account_id: input.client_account_id ?? null,
        customer_id: input.customer_id ?? null,
        assignee_staff_id: input.assignee_staff_id ?? null,
        sla_policy_id: policyBundle.id,
        sla_response_due_at: slaResponseDue,
        sla_resolution_due_at: slaResolutionDue,
        created_by_staff_id: actorStaffId,
      },
      input.idempotency_key,
    );

    await this.repo.insertActivity({
      ticket_id: ticket.id,
      actor_staff_id: actorStaffId,
      event_key: 'created',
      to_value: ticket.code,
      metadata_json: { priority: ticket.priority, status: ticket.status },
    });

    await this.audit.insert({
      actor_staff_id: actorStaffId,
      action: 'ticket.create',
      entity_type: 'ticket',
      entity_id: ticket.id,
      after_json: { code: ticket.code, title: ticket.title, priority: ticket.priority },
    });

    if (ticket.assignee_staff_id) {
      await this.repo.insertNotification({
        staff_id: ticket.assignee_staff_id,
        event_key: 'ticket.assigned',
        title_vi: 'Ticket CSD được giao',
        body_vi: `${ticket.code}: ${ticket.title}`,
        entity_type: 'ticket',
        entity_id: ticket.id,
      });
    }

    return ticket;
  }

  async get(_actorStaffId: number, id: string): Promise<CsdTicketRow> {
    const ticket = await this.repo.get(id);
    if (!ticket) throw new NotFoundException({ error: 'csd_ticket_not_found' });
    return ticket;
  }

  async list(
    _actorStaffId: number,
    query: CsdTicketListQuery,
  ): Promise<{ items: CsdTicketRow[]; next_cursor: string | null }> {
    return this.repo.list(query);
  }

  async assign(actorStaffId: number, id: string, assigneeStaffId: number): Promise<CsdTicketRow> {
    const before = await this.get(actorStaffId, id);
    const ticket = await this.repo.assign(id, assigneeStaffId, actorStaffId);

    await this.repo.insertActivity({
      ticket_id: id,
      actor_staff_id: actorStaffId,
      event_key: 'assigned',
      from_value: before.assignee_staff_id != null ? String(before.assignee_staff_id) : null,
      to_value: String(assigneeStaffId),
    });

    await this.audit.insert({
      actor_staff_id: actorStaffId,
      action: 'ticket.assign',
      entity_type: 'ticket',
      entity_id: id,
      before_json: { assignee_staff_id: before.assignee_staff_id },
      after_json: { assignee_staff_id: assigneeStaffId },
    });

    await this.repo.insertNotification({
      staff_id: assigneeStaffId,
      event_key: 'ticket.assigned',
      title_vi: 'Ticket CSD được giao',
      body_vi: `${ticket.code}: ${ticket.title}`,
      entity_type: 'ticket',
      entity_id: ticket.id,
    });

    return ticket;
  }

  async changeStatus(actorStaffId: number, id: string, to: CsdTicketStatus): Promise<CsdTicketRow> {
    const before = await this.get(actorStaffId, id);
    if (!canTransitionTicket(before.status, to)) {
      throw new ConflictException({ error: 'invalid_status_transition', from: before.status, to });
    }
    if (to === 'in_progress' && !canStartWork(before.scope_status, scopeApproved(before))) {
      throw new ConflictException({ error: 'scope_blocks_start_work', scope_status: before.scope_status });
    }

    const ticket = await this.repo.updateStatus(id, to, actorStaffId);

    await this.repo.insertActivity({
      ticket_id: id,
      actor_staff_id: actorStaffId,
      event_key: 'status_changed',
      from_value: before.status,
      to_value: to,
    });

    await this.audit.insert({
      actor_staff_id: actorStaffId,
      action: 'ticket.status',
      entity_type: 'ticket',
      entity_id: id,
      before_json: { status: before.status },
      after_json: { status: to },
    });

    return ticket;
  }

  async addComment(
    actorStaffId: number,
    id: string,
    body: { visibility: 'public' | 'internal'; body_text: string; attachment_ids?: string[] },
  ): Promise<CsdTicketCommentRow> {
    await this.get(actorStaffId, id);
    const text = String(body.body_text ?? '').trim();
    if (!text) {
      throw new BadRequestException({ error: 'body_required' });
    }

    if (body.visibility === 'public' && body.attachment_ids?.length) {
      for (const attachmentId of body.attachment_ids) {
        const visibility = await this.repo.getAttachmentVisibility(attachmentId);
        if (visibility) assertPublicAttachment(visibility);
      }
    }

    const comment = await this.repo.addComment({
      ticket_id: id,
      visibility: body.visibility,
      author_staff_id: actorStaffId,
      body_text: text,
    });

    await this.repo.insertActivity({
      ticket_id: id,
      actor_staff_id: actorStaffId,
      event_key: body.visibility === 'public' ? 'public_reply' : 'internal_note',
      metadata_json: { comment_id: comment.id },
    });

    await this.audit.insert({
      actor_staff_id: actorStaffId,
      action: 'ticket.comment',
      entity_type: 'ticket',
      entity_id: id,
      after_json: { visibility: body.visibility, comment_id: comment.id },
    });

    return comment;
  }

  async resolve(
    actorStaffId: number,
    id: string,
    body: { resolution_note: string; send_public?: boolean },
  ): Promise<CsdTicketRow> {
    const before = await this.get(actorStaffId, id);
    const note = String(body.resolution_note ?? '').trim();
    if (!note) {
      throw new UnprocessableEntityException({ error: 'resolution_note_required' });
    }

    const targetStatus: CsdTicketStatus = body.send_public ? 'client_acceptance' : 'resolved';
    if (!canTransitionTicket(before.status, targetStatus)) {
      throw new ConflictException({ error: 'invalid_status_transition', from: before.status, to: targetStatus });
    }

    const ticket = await this.repo.updateStatus(id, targetStatus, actorStaffId, {
      resolution_note: note,
      resolved_at: new Date(),
    });

    if (body.send_public) {
      await this.repo.addComment({
        ticket_id: id,
        visibility: 'public',
        author_staff_id: actorStaffId,
        body_text: note,
      });
    }

    await this.repo.insertActivity({
      ticket_id: id,
      actor_staff_id: actorStaffId,
      event_key: 'resolved',
      to_value: targetStatus,
      metadata_json: { send_public: Boolean(body.send_public) },
    });

    await this.audit.insert({
      actor_staff_id: actorStaffId,
      action: 'ticket.resolve',
      entity_type: 'ticket',
      entity_id: id,
      after_json: { status: targetStatus, resolution_note: note },
    });

    return ticket;
  }

  async listActivities(_actorStaffId: number, id: string) {
    await this.get(_actorStaffId, id);
    const items = await this.repo.listActivities(id);
    return { items };
  }

  async listComments(_actorStaffId: number, id: string) {
    await this.get(_actorStaffId, id);
    const items = await this.repo.listComments(id);
    return { items };
  }
}
