import { Injectable, Optional } from '@nestjs/common';
import { PortalCareRepository } from './portal-care.repository';
import { PortalCareNotifyService } from './portal-care-notify.service';
import {
  careDueAt,
  nextAssignee,
  receiveDueAt,
  shouldHopCare,
  shouldHopReceive,
  shouldSkipHop,
} from './portal-care.util';

/**
 * Auto-assigns and hops portal_care_cases. Extracted from PortalCareService so
 * the portal-worker process can run it after inbox/webhook sync without pulling
 * in API-only dependencies. A Postgres advisory lock per client_id serializes
 * API and worker so they cannot assign the same case twice.
 */
@Injectable()
export class PortalCareRebalanceService {
  constructor(
    private readonly repo: PortalCareRepository,
    @Optional() private readonly careNotify?: PortalCareNotifyService,
  ) {}

  async rebalance(clientId: string): Promise<void> {
    await this.repo.withClientLock(clientId, () => this.rebalanceLocked(clientId));
  }

  private async rebalanceLocked(clientId: string): Promise<void> {
    let staff = (await this.repo.listStaff(clientId)).map((row) => row.id);
    if (!staff.length) {
      staff = (await this.repo.listApprovers(clientId)).map((row) => row.id);
    }
    const active = new Set(staff);
    if (active.size) {
      await this.repo.releaseCasesWithInactiveAssignees(clientId, staff);
    }
    const loads = await this.repo.openLoads(clientId);
    const now = new Date();
    const changes: Array<{
      caseId: string;
      assigneeId: string;
      previousAssigneeId: string | null;
      reason: 'hop' | 'auto';
    }> = [];
    for (const row of await this.repo.listHopRows(clientId)) {
      if (shouldSkipHop(row, active)) continue;
      const receiveHop = shouldHopReceive(row.status, row.receive_due_at, now);
      const careHop = shouldHopCare(row.status, row.care_due_at, now);
      if (!receiveHop && !careHop) continue;
      const next = nextAssignee(staff, loads, row.assignee_user_id);
      if (!next) continue;
      const ok = receiveHop
        ? await this.repo.assignReceive(row.id, next, receiveDueAt(now), row.assignee_user_id)
        : await this.repo.assignCare(row.id, next, careDueAt(now), row.assignee_user_id);
      if (!ok) continue;
      if (row.assignee_user_id) loads[row.assignee_user_id] = Math.max(0, (loads[row.assignee_user_id] ?? 1) - 1);
      loads[next] = (loads[next] ?? 0) + 1;
      changes.push({
        caseId: row.id,
        assigneeId: next,
        previousAssigneeId: row.assignee_user_id,
        reason: 'hop',
      });
    }
    for (const id of await this.repo.listUnassigned(clientId)) {
      const next = nextAssignee(staff, loads, null);
      if (!next) break;
      const ok = await this.repo.assignReceive(id, next, receiveDueAt(now), null);
      if (!ok) continue;
      loads[next] = (loads[next] ?? 0) + 1;
      changes.push({ caseId: id, assigneeId: next, previousAssigneeId: null, reason: 'auto' });
    }
    for (const id of await this.repo.listUnassignedCare(clientId)) {
      const next = nextAssignee(staff, loads, null);
      if (!next) break;
      const ok = await this.repo.assignCare(id, next, careDueAt(now), null);
      if (!ok) continue;
      loads[next] = (loads[next] ?? 0) + 1;
      changes.push({ caseId: id, assigneeId: next, previousAssigneeId: null, reason: 'auto' });
    }
    await this.emitAssignmentChanges(clientId, changes);
  }

  private async emitAssignmentChanges(
    clientId: string,
    changes: Array<{
      caseId: string;
      assigneeId: string;
      previousAssigneeId: string | null;
      reason: 'hop' | 'auto';
    }>,
  ): Promise<void> {
    if (!this.careNotify || !changes.length) return;
    for (const change of changes) {
      try {
        await this.careNotify.notifyAssignment({
          clientId,
          caseId: change.caseId,
          assigneeId: change.assigneeId,
          previousAssigneeId: change.previousAssigneeId,
          reason: change.reason,
        });
      } catch {
        // Assignment already committed; never fail the rebalance on notify.
      }
    }
  }
}
