import { Injectable } from '@nestjs/common';
import { CsdEmailRepository } from './csd-email.repository';
import { CsdReportsRepository } from './csd-reports.repository';
import { CsdTicketsRepository } from './csd-tickets.repository';
import type { CsdTicketRow } from './csd.types';

export type CsdDashboardPayload = {
  need_action: number;
  sla_risk: number;
  reports_due: number;
  inbox_waiting: number;
  top_tickets: CsdTicketRow[];
};

@Injectable()
export class CsdDashboardService {
  constructor(
    private readonly ticketsRepo: CsdTicketsRepository,
    private readonly reportsRepo: CsdReportsRepository,
    private readonly emailRepo: CsdEmailRepository,
  ) {}

  async get(_actorStaffId: number): Promise<CsdDashboardPayload> {
    const [needAction, slaRisk, reportsDue, inboxWaiting, topTickets] = await Promise.all([
      this.ticketsRepo.countNeedAction(),
      this.ticketsRepo.countSlaRisk(),
      this.reportsRepo.countDue(),
      this.emailRepo.countUnmatched(),
      this.ticketsRepo.listTopPriority(8),
    ]);

    return {
      need_action: needAction,
      sla_risk: slaRisk,
      reports_due: reportsDue,
      inbox_waiting: inboxWaiting,
      top_tickets: topTickets,
    };
  }
}
