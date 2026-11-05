import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { IwrReportsService } from './iwr-reports.service';
import { IwrW5Repository } from './iwr-w5.repository';
import type { CreateIwrApprovalInput, IwrActor, IwrApprovalRow } from './iwr.types';

function hasCap(actor: IwrActor, action: string): boolean {
  return actor.caps.some((c) => c.section === 'iwr' && c.action === action);
}

@Injectable()
export class IwrApprovalsService {
  constructor(
    private readonly repo: IwrW5Repository,
    private readonly reports: IwrReportsService,
  ) {}

  async list(actor: IwrActor): Promise<{ items: IwrApprovalRow[] }> {
    const items = await this.repo.listApprovals(actor.staffId, hasCap(actor, 'manage'));
    return { items };
  }

  async create(actor: IwrActor, input: CreateIwrApprovalInput): Promise<IwrApprovalRow> {
    await this.reports.get(actor, input.report_id);
    return this.repo.insertApproval({
      report_id: input.report_id,
      kind: input.kind,
      requester_staff_id: actor.staffId,
      approver_staff_id: input.approver_staff_id,
      payload_json: input.payload_json,
    });
  }

  async decide(
    actor: IwrActor,
    id: string,
    input: { status: 'approved' | 'rejected'; note?: string },
  ): Promise<IwrApprovalRow> {
    const row = await this.repo.getApproval(id);
    if (!row) throw new NotFoundException({ error: 'iwr_approval_not_found' });
    if (row.approver_staff_id !== actor.staffId && !hasCap(actor, 'manage')) {
      throw new ForbiddenException({ error: 'iwr_forbidden' });
    }
    const updated = await this.repo.decideApproval(id, actor.staffId, input.status, input.note);
    if (!updated) throw new NotFoundException({ error: 'iwr_approval_not_found' });
    return updated;
  }
}
