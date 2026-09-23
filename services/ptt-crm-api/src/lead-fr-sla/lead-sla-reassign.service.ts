import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LeadSlaSettingsService } from '../lead-sla-settings/lead-sla-settings.service';
import {
  computeFr1DueAt,
  isWithinWorkingHours,
} from '../lead-sla-settings/lead-sla-working-hours.util';
import { LeadFrSlaRepository } from './lead-fr-sla.repository';
import {
  evaluateReassignDecision,
  pickRoundRobinLeastOpen,
  shouldAlertQueueWait,
  type ReassignLeadInput,
} from './lead-sla-reassign.util';

function parsePreviousIds(raw: unknown): number[] {
  if (Array.isArray(raw)) {
    return raw
      .map((x) => (typeof x === 'object' && x && 'staff_id' in x ? Number((x as { staff_id: number }).staff_id) : Number(x)))
      .filter((n) => Number.isFinite(n) && n > 0);
  }
  if (typeof raw === 'string') {
    try {
      return parsePreviousIds(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  return [];
}

function asDate(raw: unknown): Date | null {
  if (raw == null || raw === '') return null;
  const d = raw instanceof Date ? raw : new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d;
}

@Injectable()
export class LeadSlaReassignService {
  private readonly logger = new Logger(LeadSlaReassignService.name);

  constructor(
    private readonly repo: LeadFrSlaRepository,
    private readonly settings: LeadSlaSettingsService,
  ) {}

  async run(now: Date = new Date(), opts?: { force?: boolean }): Promise<{
    job_run_id: string;
    mode: 'skipped' | 'dry_run' | 'live';
    reason?: string;
    scanned: number;
    would_reassign: number;
    reassigned: number;
    escalated: number;
    nudged: number;
    queue_alerts: number;
    skipped: number;
  }> {
    const payload = await this.settings.getPublishedPayload();
    const flags = payload.feature_flags;
    const dryRunFlag = Boolean(flags.lead_sla_reassign_dry_run);
    const enabled = Boolean(flags.lead_sla_reassign_enabled);
    const live = enabled && !dryRunFlag;

    if (!opts?.force && !enabled && !dryRunFlag) {
      return {
        job_run_id: '',
        mode: 'skipped',
        reason: 'flags_off',
        scanned: 0,
        would_reassign: 0,
        reassigned: 0,
        escalated: 0,
        nudged: 0,
        queue_alerts: 0,
        skipped: 0,
      };
    }

    if (
      !opts?.force &&
      !isWithinWorkingHours(now, payload.working_hours, payload.holidays)
    ) {
      return {
        job_run_id: '',
        mode: 'skipped',
        reason: 'outside_working_hours',
        scanned: 0,
        would_reassign: 0,
        reassigned: 0,
        escalated: 0,
        nudged: 0,
        queue_alerts: 0,
        skipped: 0,
      };
    }

    const mode = live ? 'live' : 'dry_run';
    const jobRunId = `p10b-${now.toISOString().slice(0, 16).replace(/[-:T]/g, '')}-${randomUUID().slice(0, 8)}`;
    await this.repo.startJobRun(jobRunId, mode);

    const caseConfig = {
      case_1a: payload.case_1a,
      case_1b: payload.case_1b,
      case_1c: payload.case_1c,
      fr1_channels: payload.fr1_channels,
      eligible_pipeline_stages: payload.eligible_pipeline_stages,
      working_hours: payload.working_hours,
      holidays: payload.holidays,
      feature_flags: { reassign_on_1a_timeout: flags.reassign_on_1a_timeout },
    };

    const stats = {
      scanned: 0,
      would_reassign: 0,
      reassigned: 0,
      escalated: 0,
      nudged: 0,
      queue_alerts: 0,
      skipped: 0,
    };

    const dueLeads = await this.repo.listHoldDueLeads(now);
    const pool = await this.repo.listPoolCandidates();

    for (const row of dueLeads) {
      stats.scanned += 1;
      const leadId = Number(row.sqlite_lead_id);
      if (await this.repo.hasJobEvent(jobRunId, leadId)) {
        stats.skipped += 1;
        continue;
      }

      const input: ReassignLeadInput = {
        lead_id: leadId,
        owner_id: row.owner_id != null ? Number(row.owner_id) : null,
        pipeline_stage: String(row.status || ''),
        contact_status: String(row.contact_status || ''),
        hold_until: asDate(row.hold_until),
        hold_reason: String(row.hold_reason || ''),
        hold_profile: String(row.hold_profile || ''),
        last_call_result: String(row.last_call_result || ''),
        attempts_since_assign: Number(row.attempts_since_assign ?? 0),
        reassign_count: Number(row.reassign_count ?? 0),
        is_hot: Boolean(row.is_hot),
        meeting_at: asDate(row.meeting_at),
        previous_assignee_ids: parsePreviousIds(row.previous_assignee_ids),
      };

      const decision = evaluateReassignDecision(input, caseConfig, now);

      if (decision.action === 'skip') {
        stats.skipped += 1;
        continue;
      }

      if (decision.action === 'nudge') {
        await this.repo.markNeedsGdkd(leadId, true);
        await this.repo.insertReassignEvent({
          leadId,
          fromStaffId: input.owner_id,
          toStaffId: null,
          wouldToStaffId: null,
          reason: decision.reason,
          decision: decision.action,
          holdUntil: input.hold_until,
          attemptCount: input.attempts_since_assign,
          jobRunId,
          dryRun: !live,
        });
        stats.nudged += 1;
        continue;
      }

      if (decision.action === 'escalate_1a') {
        await this.repo.markNeedsGdkd(leadId, true);
        await this.repo.insertReassignEvent({
          leadId,
          fromStaffId: input.owner_id,
          toStaffId: null,
          wouldToStaffId: null,
          reason: decision.reason,
          decision: decision.action,
          holdUntil: input.hold_until,
          attemptCount: input.attempts_since_assign,
          jobRunId,
          dryRun: !live,
        });
        stats.escalated += 1;
        continue;
      }

      if (decision.action === 'invalid_path') {
        await this.repo.insertReassignEvent({
          leadId,
          fromStaffId: input.owner_id,
          toStaffId: null,
          wouldToStaffId: null,
          reason: decision.reason,
          decision: decision.action,
          holdUntil: input.hold_until,
          attemptCount: input.attempts_since_assign,
          jobRunId,
          dryRun: !live,
        });
        stats.skipped += 1;
        continue;
      }

      if (decision.action === 'unreachable_closed') {
        if (live) {
          await this.repo.applyUnreachableClosed(leadId);
        }
        await this.repo.insertReassignEvent({
          leadId,
          fromStaffId: input.owner_id,
          toStaffId: null,
          wouldToStaffId: null,
          reason: decision.reason,
          decision: decision.action,
          holdUntil: input.hold_until,
          attemptCount: input.attempts_since_assign,
          jobRunId,
          dryRun: !live,
        });
        stats.escalated += 1;
        continue;
      }

      // reassign
      const wouldTo = pickRoundRobinLeastOpen(pool, input.previous_assignee_ids, {
        maxOpen: payload.redistribute.max_open_attempting_per_am,
        cooldownDays: payload.case_1b.cooldown_days_same_am,
        now,
      });

      if (!live) {
        await this.repo.insertReassignEvent({
          leadId,
          fromStaffId: input.owner_id,
          toStaffId: null,
          wouldToStaffId: wouldTo,
          reason: `would_reassign:${decision.reason}`,
          decision: 'would_reassign',
          notes: wouldTo ? `candidate=${wouldTo}` : 'no_candidate',
          holdUntil: input.hold_until,
          attemptCount: input.attempts_since_assign,
          jobRunId,
          dryRun: true,
        });
        stats.would_reassign += 1;
        continue;
      }

      // live path
      if (input.owner_id == null) {
        stats.skipped += 1;
        continue;
      }
      await this.repo.moveToRedistributeQueue(
        leadId,
        input.owner_id,
        input.previous_assignee_ids,
      );

      if (wouldTo == null) {
        await this.repo.markNeedsGdkd(leadId, true);
        await this.repo.insertReassignEvent({
          leadId,
          fromStaffId: input.owner_id,
          toStaffId: null,
          wouldToStaffId: null,
          reason: decision.reason,
          decision: 'queued_no_candidate',
          holdUntil: input.hold_until,
          attemptCount: input.attempts_since_assign,
          jobRunId,
          dryRun: false,
        });
        stats.queue_alerts += 1;
        continue;
      }

      const fr1Due = computeFr1DueAt(
        now,
        payload.fr1_hours,
        payload.working_hours,
        payload.holidays,
      );
      await this.repo.assignFromQueue(leadId, wouldTo, fr1Due);
      await this.repo.insertReassignEvent({
        leadId,
        fromStaffId: input.owner_id,
        toStaffId: wouldTo,
        wouldToStaffId: wouldTo,
        reason: decision.reason,
        decision: 'reassigned',
        holdUntil: input.hold_until,
        attemptCount: input.attempts_since_assign,
        jobRunId,
        dryRun: false,
      });
      // refresh open counts for next pick
      const idx = pool.findIndex((p) => p.staff_id === wouldTo);
      if (idx >= 0) pool[idx].open_attempting += 1;
      stats.reassigned += 1;
    }

    // Queue wait alerts (T8)
    const queue = await this.repo.listRedistributeQueue();
    for (const row of queue) {
      const queuedAt = asDate(row.updated_at) ?? asDate(row.assigned_at);
      if (
        shouldAlertQueueWait(
          queuedAt,
          payload.redistribute.assign_queue_max_wait_working_hours,
          now,
        )
      ) {
        const leadId = Number(row.sqlite_lead_id);
        if (await this.repo.hasJobEvent(jobRunId, leadId)) continue;
        await this.repo.markNeedsGdkd(leadId, true);
        await this.repo.insertReassignEvent({
          leadId,
          fromStaffId: null,
          toStaffId: null,
          wouldToStaffId: null,
          reason: 'queue_wait_exceeded',
          decision: 'queue_alert',
          holdUntil: asDate(row.hold_until),
          attemptCount: 0,
          jobRunId,
          dryRun: !live,
        });
        stats.queue_alerts += 1;
      }
    }

    await this.repo.finishJobRun(jobRunId, stats);
    this.logger.log(
      `LeadSlaReassignJob ${mode} run=${jobRunId} scanned=${stats.scanned} would=${stats.would_reassign} reassigned=${stats.reassigned}`,
    );
    return { job_run_id: jobRunId, mode, ...stats };
  }

  listDryRunEvents(limit = 50, offset = 0) {
    return this.repo.listReassignEvents({ dryRun: true, limit, offset });
  }

  listAllEvents(limit = 50, offset = 0, dryRun?: boolean) {
    return this.repo.listReassignEvents({ dryRun, limit, offset });
  }
}
