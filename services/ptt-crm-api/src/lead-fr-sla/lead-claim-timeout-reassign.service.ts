import { Injectable, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  businessCalendar,
  type BusinessCalendar,
} from '../leads-funnel/business-hours.util';
import { caseStaffNotify } from '../leads-funnel/case-staff-notify.util';
import { StaffNotificationsRepository } from '../staff-notifications/staff-notifications.repository';
import { TeamSlaService } from '../team-sla/team-sla.service';
import { LeadFrSlaRepository } from './lead-fr-sla.repository';
import {
  CLAIM_TIMEOUT_REASON,
  CLAIM_TIMEOUT_TICK_CAP,
  isClaimDeadlinePassed,
  isClaimTimeoutReassignEnabled,
  isClaimTimeoutWindowOpen,
  parsePreviousAssigneeIds,
  resolveClaimTimeoutPool,
} from './lead-claim-timeout-reassign.util';
import { pickRoundRobinLeastOpen } from './lead-sla-reassign.util';

@Injectable()
export class LeadClaimTimeoutReassignService {
  private readonly logger = new Logger(LeadClaimTimeoutReassignService.name);

  constructor(
    private readonly repo: LeadFrSlaRepository,
    private readonly teamSla: TeamSlaService,
    @Optional() private readonly notifications?: StaffNotificationsRepository,
  ) {}

  async run(now: Date = new Date()): Promise<{
    job_run_id: string;
    mode: 'skipped' | 'live';
    reason?: string;
    scanned: number;
    reassigned: number;
    skipped: number;
  }> {
    if (!isClaimTimeoutReassignEnabled()) {
      return {
        job_run_id: '',
        mode: 'skipped',
        reason: 'flag_off',
        scanned: 0,
        reassigned: 0,
        skipped: 0,
      };
    }

    const calendar: BusinessCalendar = businessCalendar('sale_service');
    if (!isClaimTimeoutWindowOpen(now, calendar)) {
      return {
        job_run_id: '',
        mode: 'skipped',
        reason: 'outside_working_hours',
        scanned: 0,
        reassigned: 0,
        skipped: 0,
      };
    }

    const claimMinutes = await this.teamSla.saleClaimMinutes();
    const jobRunId = `claim-timeout-${now.toISOString().slice(0, 16).replace(/[-:T]/g, '')}-${randomUUID().slice(0, 8)}`;
    await this.repo.startJobRun(jobRunId, 'live');

    const stats = { scanned: 0, reassigned: 0, skipped: 0 };
    const notifies: Array<{ staffId: number; leadId: number }> = [];

    try {
      await this.repo.withLeadTransaction(async (tx) => {
        const locked = await this.repo.lockClaimTimeoutDueLeads(tx, {
          now,
          claimMinutes,
          limit: CLAIM_TIMEOUT_TICK_CAP,
        });
        stats.scanned = locked.length;

        const projectIds = [
          ...new Set(
            locked
              .map((row) => row.b2b_project_id)
              .filter((id): id is string => Boolean(id)),
          ),
        ];
        const globalPool = await this.repo.listClaimTimeoutSalesPool(null);
        const projectPools = new Map<string, Awaited<ReturnType<LeadFrSlaRepository['listClaimTimeoutSalesPool']>>>();
        for (const projectId of projectIds) {
          projectPools.set(projectId, await this.repo.listClaimTimeoutSalesPool(projectId));
        }

        for (const row of locked) {
          if (
            !isClaimDeadlinePassed(row.assigned_at, now, claimMinutes, calendar)
          ) {
            stats.skipped += 1;
            continue;
          }

          const previous = parsePreviousAssigneeIds(row.previous_assignee_ids);
          const ownerId = row.owner_id;
          const blocked = Array.from(new Set([...previous, ownerId]));
          const projectPool = row.b2b_project_id
            ? (projectPools.get(row.b2b_project_id) ?? [])
            : [];
          const picked = resolveClaimTimeoutPool(projectPool, globalPool, ownerId);
          const toStaffId = pickRoundRobinLeastOpen(picked.candidates, blocked, {
            maxOpen: 10_000,
            cooldownDays: 0,
            now,
          });

          if (toStaffId == null || toStaffId === ownerId) {
            await this.repo.insertReassignEvent({
              leadId: row.lead_id,
              fromStaffId: ownerId,
              toStaffId: null,
              wouldToStaffId: null,
              reason: CLAIM_TIMEOUT_REASON,
              decision: 'skipped_no_candidate',
              notes: `pool=${picked.source}`,
              holdUntil: null,
              attemptCount: row.attempts_since_assign,
              jobRunId,
              dryRun: false,
              client: tx,
            });
            stats.skipped += 1;
            continue;
          }

          const applied = await this.repo.applyClaimTimeoutReassign(tx, {
            leadId: row.lead_id,
            fromOwnerId: ownerId,
            toOwnerId: toStaffId,
            previousAssigneeIds: previous,
          });
          if (!applied) {
            stats.skipped += 1;
            continue;
          }

          const idx = picked.candidates.findIndex((c) => c.staff_id === toStaffId);
          if (idx >= 0) picked.candidates[idx].open_attempting += 1;
          const gIdx = globalPool.findIndex((c) => c.staff_id === toStaffId);
          if (gIdx >= 0) globalPool[gIdx].open_attempting += 1;

          await this.repo.insertReassignEvent({
            leadId: row.lead_id,
            fromStaffId: ownerId,
            toStaffId: toStaffId,
            wouldToStaffId: toStaffId,
            reason: CLAIM_TIMEOUT_REASON,
            decision: 'reassigned',
            notes: `pool=${picked.source}`,
            holdUntil: null,
            attemptCount: row.attempts_since_assign,
            jobRunId,
            dryRun: false,
            client: tx,
          });
          await this.repo.insertClaimTimeoutSystemNote(
            tx,
            row.lead_id,
            ownerId,
            toStaffId,
            claimMinutes,
          );
          notifies.push({ staffId: toStaffId, leadId: row.lead_id });
          stats.reassigned += 1;
        }
      });
    } catch (err) {
      await this.repo.finishJobRun(jobRunId, stats).catch(() => undefined);
      throw err;
    }

    if (this.notifications) {
      for (const item of notifies) {
        await this.notifications
          .notifyStaff(
            item.staffId,
            caseStaffNotify({
              kind: 'lead_assigned',
              leadId: item.leadId,
              claimMinutes,
            }),
          )
          .catch(() => undefined);
      }
    }

    await this.repo.finishJobRun(jobRunId, {
      ...stats,
      would_reassign: 0,
      escalated: 0,
      nudged: 0,
      queue_alerts: 0,
    });
    this.logger.log(
      `ClaimTimeoutReassignJob live run=${jobRunId} scanned=${stats.scanned} reassigned=${stats.reassigned} skipped=${stats.skipped}`,
    );
    return { job_run_id: jobRunId, mode: 'live', ...stats };
  }
}
