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
    // t350u: the auto-assign pool of a case is the active staff assigned to that case's Page.
    // A Page with no staff falls back to the approvers (account owner), as before when no staff existed.
    const byPage = await this.repo.staffPoolByPage(clientId);
    const approvers = (await this.repo.listApprovers(clientId)).map((row) => row.id);
    const poolFor = (pageId: string): string[] => {
      const staff = byPage[pageId] ?? [];
      return staff.length ? staff : approvers;
    };

    // Safety net: release open cases whose assignee is not in the pool of the case's Page
    // (inactive/deleted staff, or staff no longer assigned to that Page).
    const misplaced = (await this.repo.listOpenAssigned(clientId))
      .filter((row) => {
        const pool = poolFor(row.page_id);
        return pool.length > 0 && !pool.includes(row.assignee_user_id);
      })
      .map((row) => row.id);
    if (misplaced.length) {
      await this.repo.releaseCases(clientId, misplaced);
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
      const pool = poolFor(row.page_id);
      if (shouldSkipHop(row, new Set(pool))) continue;
      const receiveHop = shouldHopReceive(row.status, row.receive_due_at, now);
      const careHop = shouldHopCare(row.status, row.care_due_at, now);
      if (!receiveHop && !careHop) continue;
      const next = nextAssignee(pool, loads, row.assignee_user_id);
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
    for (const row of await this.repo.listUnassigned(clientId)) {
      const next = nextAssignee(poolFor(row.page_id), loads, null);
      if (!next) continue;
      const ok = await this.repo.assignReceive(row.id, next, receiveDueAt(now), null);
      if (!ok) continue;
      loads[next] = (loads[next] ?? 0) + 1;
      changes.push({ caseId: row.id, assigneeId: next, previousAssigneeId: null, reason: 'auto' });
    }
    for (const row of await this.repo.listUnassignedCare(clientId)) {
      const next = nextAssignee(poolFor(row.page_id), loads, null);
      if (!next) continue;
      const ok = await this.repo.assignCare(row.id, next, careDueAt(now), null);
      if (!ok) continue;
      loads[next] = (loads[next] ?? 0) + 1;
      changes.push({ caseId: row.id, assigneeId: next, previousAssigneeId: null, reason: 'auto' });
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
