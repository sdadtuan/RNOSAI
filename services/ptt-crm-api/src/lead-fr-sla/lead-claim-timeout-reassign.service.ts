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
} from './lead-claim-timeout-reassign.util';
import {
  CLAIM_QUEUE_AWAITING_AM_LABEL,
  CLAIM_ROUND_EXHAUSTED_DECISION,
  claimDueAtFor,
  insertClaimHistory,
  listAccountManagerIds,
  listSalesOrder,
  loadPausedSales,
  parseRoundTried,
  pickNextUntriedSale,
} from './lead-claim-round.util';

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
    awaiting_am?: number;
    callback_reminders?: number;
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

    const stats = { scanned: 0, reassigned: 0, skipped: 0, awaiting_am: 0, callback_reminders: 0 };
    const notifies: Array<{ staffId: number; leadId: number }> = [];
    const amAlerts: number[] = [];

    try {
      await this.repo.withLeadTransaction(async (tx) => {
        const locked = await this.repo.lockClaimTimeoutDueLeads(tx, {
          now,
          claimMinutes,
          limit: CLAIM_TIMEOUT_TICK_CAP,
        });
        stats.scanned = locked.length;

        const txQuery = (sql: string, params: unknown[] = []) => tx.query(sql, params);
        const paused = await loadPausedSales((sql, params) => this.repo.query(sql, params ?? []));
        const poolCache = new Map<string, { source: 'project' | 'global'; order: number[] }>();
        const poolFor = async (projectId: string | null) => {
          const key = projectId ?? '';
          let hit = poolCache.get(key);
          if (!hit) {
            hit = await listSalesOrder((sql, params) => this.repo.query(sql, params ?? []), projectId);
            poolCache.set(key, hit);
          }
          return hit;
        };

        for (const row of locked) {
          if (
            !isClaimDeadlinePassed(row.assigned_at, now, claimMinutes, calendar)
          ) {
            stats.skipped += 1;
            continue;
          }

          const previous = parsePreviousAssigneeIds(row.previous_assignee_ids);
          const ownerId = row.owner_id;
          const mode = row.claim_round_mode;
          // Legacy rows (before rounds existed): the claim-timeout hops so far are this round.
          const roundSoFar = mode ? parseRoundTried(row.claim_round_tried) : previous;
          const tried = Array.from(new Set([...roundSoFar, ownerId]));
          const pool = await poolFor(row.b2b_project_id);
          // Manual (AM) assignment missed → straight back to AM; otherwise next untried Sale in order.
          const toStaffId =
            mode === 'manual' ? null : pickNextUntriedSale(pool.order, tried, ownerId, paused);

          if (toStaffId == null || toStaffId === ownerId) {
            const marked = await this.repo.markAwaitingAmAssign(tx, {
              leadId: row.lead_id,
              ownerId,
              roundTried: tried,
            });
            if (!marked) {
              stats.skipped += 1;
              continue;
            }
            await insertClaimHistory(txQuery, {
              leadId: row.lead_id,
              fromStaffId: ownerId,
              toStaffId: null,
              reason: CLAIM_TIMEOUT_REASON,
              decision: CLAIM_ROUND_EXHAUSTED_DECISION,
              mode: mode === 'manual' ? 'manual' : 'auto',
              assignedAt: row.assigned_at,
              claimDueAt: claimDueAtFor(row.assigned_at, claimMinutes),
              notes: `QUÁ HẠN NHẬN LEAD; ${CLAIM_QUEUE_AWAITING_AM_LABEL}; pool=${pool.source}; tried=${tried.join(',')}`,
              jobRunId,
            });
            await this.repo.insertAwaitingAmSystemNote(
              tx,
              row.lead_id,
              ownerId,
              tried.filter((id) => pool.order.includes(id)).length || tried.length,
              claimMinutes,
            );
            amAlerts.push(row.lead_id);
            stats.awaiting_am += 1;
            continue;
          }

          const assignedAt = await this.repo.applyClaimTimeoutReassign(tx, {
            leadId: row.lead_id,
            fromOwnerId: ownerId,
            toOwnerId: toStaffId,
            previousAssigneeIds: previous,
            roundTried: tried,
          });
          if (!assignedAt) {
            stats.skipped += 1;
            continue;
          }

          await insertClaimHistory(txQuery, {
            leadId: row.lead_id,
            fromStaffId: ownerId,
            toStaffId,
            reason: CLAIM_TIMEOUT_REASON,
            decision: 'reassigned',
            mode: 'auto',
            assignedAt,
            claimDueAt: claimDueAtFor(assignedAt, claimMinutes),
            notes: `QUÁ HẠN NHẬN LEAD; pool=${pool.source}; tried=${[...tried, toStaffId].join(',')}`,
            jobRunId,
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

    if (this.notifications && amAlerts.length) {
      const amIds = await listAccountManagerIds((sql, params) => this.repo.query(sql, params ?? [])).catch(
        () => [] as number[],
      );
      for (const leadId of amAlerts) {
        for (const amId of amIds) {
          await this.notifications
            .notifyStaff(amId, {
              kind: 'lead_awaiting_am',
              title: 'Lead chờ AM phân công',
              body: `Lead #${leadId} — hết vòng Sales, không ai nhận trong ${claimMinutes} phút/lượt. Chọn Sales và giao tay.`,
              link_href: `/crm/leads/${leadId}`,
              meta_json: { lead_id: leadId, action: 'am_assign_lead' },
            })
            .catch(() => undefined);
        }
      }
    }

    stats.callback_reminders = await this.remindCallbackRetries(now).catch((err) => {
      this.logger.warn(`callback retry reminders failed: ${err instanceof Error ? err.message : String(err)}`);
      return 0;
    });

    await this.repo.finishJobRun(jobRunId, {
      ...stats,
      would_reassign: 0,
      escalated: stats.awaiting_am,
      nudged: stats.callback_reminders,
      queue_alerts: 0,
    });
    this.logger.log(
      `ClaimTimeoutReassignJob live run=${jobRunId} scanned=${stats.scanned} reassigned=${stats.reassigned} awaiting_am=${stats.awaiting_am} callback_reminders=${stats.callback_reminders} skipped=${stats.skipped}`,
    );
    return { job_run_id: jobRunId, mode: 'live', ...stats };
  }

  /** CHỜ GỌI LẠI: remind the owner once per retry slot (team-SLA retry_gap_hours). */
  private async remindCallbackRetries(now: Date): Promise<number> {
    const due = await this.repo.listCallbackRetryDue(now, 50);
    if (!due.length) return 0;
    const retryHours = await this.teamSla.saleRetryGapHours();
    let sent = 0;
    for (const row of due) {
      const marked = await this.repo.markCallbackReminded(row.lead_id, retryHours);
      if (!marked) continue;
      sent += 1;
      if (this.notifications) {
        await this.notifications
          .notifyStaff(row.owner_id, {
            kind: 'lead_callback_due',
            title: 'Đến giờ gọi lại khách',
            body: `Lead #${row.lead_id} — CHỜ GỌI LẠI: lần trước không nghe máy, gọi lại ngay (mỗi ${retryHours} giờ).`,
            link_href: `/crm/leads/${row.lead_id}`,
            meta_json: { lead_id: row.lead_id, action: 'callback_retry' },
          })
          .catch(() => undefined);
      }
    }
    return sent;
  }
}
