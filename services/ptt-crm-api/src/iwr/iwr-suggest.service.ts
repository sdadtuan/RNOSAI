import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CsdTicketsRepository } from '../csd/csd-tickets.repository';
import type { CsdTicketRow } from '../csd/csd.types';
import { ancestorIds, isOnPath } from './iwr-org.util';
import { IwrOrgRepository, IwrReportsRepository } from './iwr-reports.repository';
import type { IwrActor, IwrSuggestHit } from './iwr.types';

function hasIwrCap(actor: IwrActor, action: string): boolean {
  return actor.caps.some((c) => c.section === 'iwr' && c.action === action);
}

function ymdOf(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function ticketReason(ticket: CsdTicketRow, periodYmd: string): IwrSuggestHit['reason'] | null {
  const status = String(ticket.status ?? '').toLowerCase();
  if (ymdOf(ticket.closed_at) === periodYmd) return 'closed_today';
  if (status.includes('block')) return 'blocked';
  const due = ticket.sla_resolution_due_at ? new Date(ticket.sla_resolution_due_at).getTime() : 0;
  if (
    ticket.sla_status === 'breached' ||
    (due > 0 && due < Date.now() && status !== 'closed' && status !== 'resolved')
  ) {
    return 'overdue';
  }
  if (ymdOf(ticket.updated_at) === periodYmd || ymdOf(ticket.resolved_at) === periodYmd) {
    return 'updated_today';
  }
  return null;
}

@Injectable()
export class IwrSuggestService {
  constructor(
    private readonly tickets: CsdTicketsRepository,
    private readonly repo: IwrReportsRepository,
    private readonly org: IwrOrgRepository,
  ) {}

  async suggestForReport(actor: IwrActor, reportId: string): Promise<{ items: IwrSuggestHit[] }> {
    const report = await this.repo.getReport(reportId);
    if (!report) throw new NotFoundException({ error: 'iwr_report_not_found' });

    const canAuthor = report.author_staff_id === actor.staffId;
    const canManage = hasIwrCap(actor, 'manage') || hasIwrCap(actor, 'executive');
    const recipient = await this.repo.isRecipient(reportId, actor.staffId);
    let onPath = false;
    if (!canAuthor && !canManage && !recipient) {
      const nodes = await this.org.listActiveStaff();
      onPath =
        ancestorIds(report.author_staff_id, nodes).includes(actor.staffId) ||
        isOnPath(actor.staffId, report.author_staff_id, nodes);
    }
    if (!canAuthor && !canManage && !recipient && !onPath) {
      throw new ForbiddenException({ error: 'iwr_forbidden' });
    }

    const ymd = report.period_start;
    const ticketRows = await this.tickets.listForStaff(actor.staffId, ymd);
    const items: IwrSuggestHit[] = [];
    for (const ticket of ticketRows) {
      const reason = ticketReason(ticket, ymd);
      if (!reason) continue;
      items.push({
        kind: 'csd_ticket',
        id: ticket.id,
        label: `${ticket.code} ${ticket.title}`.trim(),
        reason,
      });
      if (items.length >= 20) break;
    }

    if (items.length < 20) {
      const leads = await this.org.listLeadUpdates(actor.staffId, ymd);
      for (const lead of leads) {
        items.push({
          kind: 'lead',
          id: lead.id,
          label: lead.label,
          reason: 'updated_today',
        });
        if (items.length >= 20) break;
      }
    }

    return { items };
  }
}
