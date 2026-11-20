import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { addWorkingHours } from '../lead-sla-settings/lead-sla-working-hours.util';
import { caseStaffNotify } from '../leads-funnel/case-staff-notify.util';
import { StaffNotificationsRepository } from '../staff-notifications/staff-notifications.repository';
import { TeamSlaService } from '../team-sla/team-sla.service';
import {
  CLAIM_QUEUE_AWAITING_AM,
  CLAIM_QUEUE_AWAITING_AM_LABEL,
  amCannotClaimSalesLead,
  isSalesStaff,
  listAccountManagerIds,
  startClaimRound,
} from './lead-claim-round.util';
import { assertEligibleLeadOwner } from '../ae-team/eligible-lead-owner';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { LeadSlaSettingsService } from '../lead-sla-settings/lead-sla-settings.service';
import {
  LEAD_HIDDEN_CONTACT_STATUS,
  LEAD_LOCKED_CONTACT_STATUS,
  LEAD_LOCKED_MESSAGE_VI,
} from '../leads/lead-lock.util';
import { isStatusTransitionAllowed } from '../leads/lead-status-gate.util';
import { LeadsRepository } from '../leads/leads.repository';
import { LeadsWriteService } from '../leads/leads-write.service';
import { formatLeadCallActivity } from './lead-call-activity.util';
import { ACTIVITY_DEDUPE_MINUTES, evaluateCallGap, evaluateDuplicateLog, formatCallGapRetryAt } from './lead-call-gap.util';
import {
  applyCallLogToSnapshot,
  type RecomputeResult,
} from './lead-fr-sla-hold.util';
import {
  LeadFrSlaRepository,
  type LeadCallAttemptRow,
} from './lead-fr-sla.repository';
import {
  isCallResult,
  type LeadCallResult,
  type LeadFrSlaCaseConfig,
  type LeadFrSlaSnapshot,
} from './lead-fr-sla.types';

export type LogCallBody = {
  call_result: string;
  channel?: string;
  started_at?: string;
  disposition?: string;
  notes?: string;
  duration_sec?: number | null;
  meeting_at?: string | null;
  meeting_place?: string | null;
  callback_at?: string | null;
  wrong_number_confirmed?: boolean;
  staff_id?: number | null;
};

function parseDate(raw: unknown, fallback: Date): Date {
  if (raw == null || raw === '') return fallback;
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException({ error: 'invalid_started_at' });
  }
  return d;
}

function asDate(raw: unknown): Date | null {
  if (raw == null || raw === '') return null;
  const d = raw instanceof Date ? raw : new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d;
}

@Injectable()
export class LeadFrSlaService {
  constructor(
    private readonly repo: LeadFrSlaRepository,
    private readonly settings: LeadSlaSettingsService,
    private readonly leads: LeadsRepository,
    private readonly leadsWrite: LeadsWriteService,
    private readonly staffAuth: StaffAuthService,
    @Optional() private readonly teamSla?: TeamSlaService,
    @Optional() private readonly notifications?: StaffNotificationsRepository,
  ) {}

  private sqlQuery = (sql: string, params: unknown[] = []) => this.repo.query(sql, params);

  /** Retry gap between phone calls (CHỜ GỌI LẠI). Team-SLA retry_gap_hours, else lead-SLA case_1b. */
  private async retryGapHours(fallback: number): Promise<number> {
    const n = this.teamSla ? await this.teamSla.saleRetryGapHours().catch(() => NaN) : NaN;
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  /** AM (ACM / KD-01) or Super-Admin. */
  async canAmAssign(staffUser?: StaffJwtPayload): Promise<boolean> {
    if (!staffUser) return false;
    if (await this.staffAuth.isSuperAdminUser(staffUser).catch(() => false)) return true;
    const staffId = await this.staffAuth.resolveCrmStaffUserId(staffUser);
    if (staffId == null) return false;
    const am = await listAccountManagerIds(this.sqlQuery).catch(() => [] as number[]);
    return am.includes(staffId);
  }

  /** CHỜ AM PHÂN LEAD → AM chọn Sales, xác nhận giao; CRM bắt đầu lượt nhận mới. */
  async amAssignSales(leadId: number, targetStaffId: number, staffUser: StaffJwtPayload | undefined, actor: string) {
    if (!(await this.canAmAssign(staffUser))) {
      throw new ForbiddenException({ error: 'Chỉ AM hoặc Super-Admin được giao tay lead.' });
    }
    const target = Number(targetStaffId);
    if (!(await isSalesStaff(this.sqlQuery, target))) {
      throw new BadRequestException({ error: 'Chỉ giao cho nhân viên Sales.' });
    }
    try {
      await assertEligibleLeadOwner(this.sqlQuery, target);
    } catch (err) {
      throw new BadRequestException({
        error: 'owner_not_accepting',
        message: err instanceof Error ? err.message : 'Nhân viên này chưa bật nhận lead hoặc đang tạm dừng.',
      });
    }
    const row = await this.repo.getLeadSlaRow(leadId);
    if (!row) throw new NotFoundException({ error: 'lead_not_found' });
    const fromOwner = row.owner_id != null ? Number(row.owner_id) : null;
    if (fromOwner !== target) {
      // patchLead logs the assignment, resets the clocks, notifies the Sale and starts the manual round.
      await this.leadsWrite.patchLead(
        leadId,
        { owner_id: target, assign_reason: 'am_manual_assign', assigned_by: actor, split: 'reset_closer' },
        actor,
      );
    } else {
      // Same Sale again: fresh claim window, manual round.
      await this.settings.applyFr1OnNewAssign(leadId).catch(() => undefined);
      const claimMinutes = (await this.teamSla?.saleClaimMinutes().catch(() => 15)) ?? 15;
      await startClaimRound(this.sqlQuery, {
        leadId,
        ownerId: target,
        fromOwnerId: fromOwner,
        mode: 'manual',
        reason: 'am_manual_assign',
        claimMinutes,
        notes: `by=${actor}`,
      });
      await this.notifications
        ?.notifyStaff(target, caseStaffNotify({ kind: 'lead_assigned', leadId, claimMinutes }))
        .catch(() => undefined);
    }
    return this.readSla(leadId, staffUser);
  }

  private async caseConfig(): Promise<LeadFrSlaCaseConfig> {
    const p = await this.settings.getPublishedPayload();
    return {
      case_1a: p.case_1a,
      case_1b: p.case_1b,
      case_1c: p.case_1c,
      fr1_channels: p.fr1_channels,
      eligible_pipeline_stages: p.eligible_pipeline_stages,
      working_hours: p.working_hours,
      holidays: p.holidays,
    };
  }

  private rowToSnapshot(row: Record<string, unknown>): LeadFrSlaSnapshot {
    const assigned =
      asDate(row.assigned_at) ??
      asDate(row.first_assigned_at) ??
      new Date();
    return {
      assigned_at: assigned,
      fr1_due_at: asDate(row.fr1_due_at),
      first_call_at: asDate(row.first_call_at),
      fr1_breached: Boolean(row.fr1_breached),
      contact_status: String(row.contact_status || 'new'),
      hold_until: asDate(row.hold_until),
      hold_reason: String(row.hold_reason || ''),
      hold_profile: String(row.hold_profile || ''),
      attempts_since_assign: Number(row.attempts_since_assign ?? 0),
      call_attempt_count: Number(row.call_attempt_count ?? 0),
      is_hot: Boolean(row.is_hot),
      meeting_at: asDate(row.meeting_at),
      callback_at: asDate(row.callback_at),
      pipeline_stage: String(row.status || ''),
      last_call_result: String(row.last_call_result || ''),
    };
  }

  async claimSalesLead(leadId: number, staffUser?: StaffJwtPayload) {
    const row = await this.repo.getLeadSlaRow(leadId);
    if (!row) throw new NotFoundException({ error: 'lead_not_found' });
    const staffId = staffUser
      ? await this.staffAuth.resolveCrmStaffUserId(staffUser)
      : null;
    const isSuper = staffUser ? await this.staffAuth.isSuperAdminUser(staffUser) : false;
    const amIds = await listAccountManagerIds(this.sqlQuery).catch(() => [] as number[]);
    if (amCannotClaimSalesLead(staffId != null && amIds.includes(staffId), isSuper)) {
      throw new ForbiddenException({
        error: 'am_cannot_claim_lead',
        message: 'Vai trò AM không nhận lead. Sales bấm Nhận lead.',
      });
    }
    const ownerId = Number(row.owner_id ?? 0);
    if (!isSuper && (staffId == null || staffId !== ownerId)) {
      throw new ForbiddenException({
        error: 'Chỉ người được giao lead mới nhận được.',
      });
    }
    const claimedAtIso = await this.repo.claimSalesLead(leadId, staffId);
    // Doc: sau khi nhận, Sales liên hệ khách trong N giờ (team-SLA update_after_claim_hours).
    const payloadForClaim = await this.settings.getPublishedPayload();
    const updateHours = (await this.teamSla?.saleUpdateAfterClaimHours().catch(() => 1)) ?? 1;
    await this.repo
      .setFr1DueFromClaim(
        leadId,
        addWorkingHours(new Date(claimedAtIso), updateHours, payloadForClaim.working_hours, payloadForClaim.holidays),
      )
      .catch(() => undefined);
    return this.readSla(leadId, staffUser);
  }

  /**
   * Ẩn lead — same hide/lock as confirmed Sai số, with its own status and audit.
   * Writers: crm_leads edit/assign, Solution edit, or Super Admin.
   */
  async hideLead(
    leadId: number,
    notesRaw: string,
    staffUser: StaffJwtPayload | undefined,
    actor: string,
  ) {
    const notes = String(notesRaw ?? '').trim();
    if (notes.length < 3 || notes.length > 500) {
      throw new BadRequestException({
        error: 'note_required',
        message: 'Ghi chú Ẩn lead cần từ 3 đến 500 ký tự.',
      });
    }
    await this.assertCanHideLead(staffUser);
    const row = await this.repo.getLeadSlaRow(leadId);
    if (!row) throw new NotFoundException({ error: 'lead_not_found' });
    const status = String(row.contact_status ?? '');
    if (status === LEAD_LOCKED_CONTACT_STATUS) {
      throw new ForbiddenException({ error: 'lead_locked', message: LEAD_LOCKED_MESSAGE_VI });
    }
    if (status === LEAD_HIDDEN_CONTACT_STATUS) {
      return { ok: true, lead_id: leadId, already_hidden: true };
    }
    const staffId = staffUser ? await this.staffAuth.resolveCrmStaffUserId(staffUser) : null;
    const closed = `staff_hidden_lead: ${notes}`.slice(0, 240);
    await this.repo.hideLead(leadId, closed);
    await this.repo
      .recordStaffNote({
        leadId,
        staffId,
        content: `Ẩn lead — ${notes}`.slice(0, 8000),
        result: 'hidden_lead',
        createdBy: actor,
      })
      .catch(() => undefined);
    await this.repo
      .insertReassignEvent({
        leadId,
        fromStaffId: row.owner_id != null ? Number(row.owner_id) : null,
        toStaffId: null,
        wouldToStaffId: null,
        reason: 'staff_hide_lead',
        decision: 'hidden_path',
        notes: `actor=${actor}; ${notes}`.slice(0, 2000),
        holdUntil: asDate(row.hold_until),
        attemptCount: Number(row.attempts_since_assign ?? 0),
        jobRunId: `hide-${leadId}-${Date.now()}`,
        dryRun: false,
      })
      .catch(() => undefined);
    return { ok: true, lead_id: leadId, already_hidden: false };
  }

  private async assertCanHideLead(staffUser?: StaffJwtPayload): Promise<void> {
    if (!staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    if (await this.staffAuth.isSuperAdminUser(staffUser).catch(() => false)) return;
    const me = await this.staffAuth.me(staffUser);
    const ok =
      this.staffAuth.hasCap(me.caps, 'crm_leads', 'edit') ||
      this.staffAuth.hasCap(me.caps, 'crm_leads', 'assign') ||
      this.staffAuth.hasCap(me.caps, 'crm_presales_solution', 'edit');
    if (!ok) {
      throw new ForbiddenException({
        error: 'missing_cap',
        message: 'Bạn chưa được cấp quyền ẩn lead.',
      });
    }
  }

  async readSla(leadId: number, staffUser?: StaffJwtPayload) {
    const row = await this.repo.getLeadSlaRow(leadId);
    if (!row) throw new NotFoundException({ error: 'lead_not_found' });
    const payload = await this.settings.getPublishedPayload();
    const gapHours = await this.retryGapHours(payload.case_1b.min_gap_working_hours);
    const updateHours = (await this.teamSla?.saleUpdateAfterClaimHours().catch(() => 1)) ?? 1;
    const claimQueueState = String(row.claim_queue_state ?? '');
    const awaitingAm = claimQueueState === CLAIM_QUEUE_AWAITING_AM;
    const canAm = awaitingAm ? await this.canAmAssign(staffUser) : false;
    const salesOptions = canAm ? await this.repo.listSalesAssignOptions().catch(() => []) : [];
    const snap = this.rowToSnapshot(row);
    const now = Date.now();
    const fr1DueMs = snap.fr1_due_at?.getTime() ?? null;
    const fr1Open = !snap.first_call_at && fr1DueMs != null;
    const fr1Overdue =
      snap.fr1_breached || (fr1Open && fr1DueMs != null && now > fr1DueMs);
    const attempts = await this.repo.listAttempts(leadId, 20);
    const lastValidPhone = attempts.find(
      (a) => a.channel === 'phone' && a.counts_toward_sla && !a.warn_call_too_soon,
    );
    const phoneGap = evaluateCallGap({
      lastCallAt: lastValidPhone ? new Date(lastValidPhone.started_at) : null,
      now: new Date(),
      minGapWorkingHours: gapHours,
    });
    return {
      lead_id: leadId,
      settings_version: payload.settings_version,
      fr1_hours: updateHours,
      claim_queue_state: claimQueueState,
      claim_queue_label: awaitingAm ? CLAIM_QUEUE_AWAITING_AM_LABEL : '',
      claim_queue_state_at: asDate(row.claim_queue_state_at)?.toISOString() ?? null,
      claim_round_mode: String(row.claim_round_mode ?? ''),
      can_am_assign: canAm,
      sales_options: salesOptions,
      fr1_channels: payload.fr1_channels,
      reassign_enabled: payload.feature_flags.lead_sla_reassign_enabled,
      assigned_at: snap.assigned_at.toISOString(),
      sales_claimed_at: asDate(row.sales_claimed_at)?.toISOString() ?? null,
      fr1_due_at: snap.fr1_due_at?.toISOString() ?? null,
      first_call_at: snap.first_call_at?.toISOString() ?? null,
      fr1_breached: snap.fr1_breached,
      fr1_overdue: fr1Overdue,
      fr1_remaining_ms: fr1Open && fr1DueMs != null ? fr1DueMs - now : null,
      hold_until: snap.hold_until?.toISOString() ?? null,
      hold_reason: snap.hold_reason,
      hold_profile: snap.hold_profile,
      contact_status: snap.contact_status,
      attempts_since_assign: snap.attempts_since_assign,
      call_attempt_count: snap.call_attempt_count,
      last_call_at: asDate(row.last_call_at)?.toISOString() ?? null,
      last_call_result: snap.last_call_result,
      meeting_at: snap.meeting_at?.toISOString() ?? null,
      callback_at: snap.callback_at?.toISOString() ?? null,
      is_hot: snap.is_hot,
      pipeline_stage: snap.pipeline_stage,
      eligible: payload.eligible_pipeline_stages
        .map((s) => s.toLowerCase())
        .includes(String(snap.pipeline_stage || '').toLowerCase()) ||
        !String(snap.pipeline_stage || '').trim(),
      attempts,
      min_gap_working_hours: gapHours,
      next_call_allowed_at: phoneGap.nextAllowedAt?.toISOString() ?? null,
      call_gap_blocked: phoneGap.blocked,
      call_gap_message: phoneGap.message,
    };
  }

  async logCall(
    leadId: number,
    body: LogCallBody,
    actor: string,
  ): Promise<{
    sla: Awaited<ReturnType<LeadFrSlaService['readSla']>>;
    attempt: LeadCallAttemptRow;
    recompute: Pick<
      RecomputeResult,
      'counts_toward_fr1' | 'counts_toward_sla' | 'warn_call_too_soon' | 'sla_frozen'
    >;
  }> {
    const result = String(body.call_result || '').trim();
    if (!isCallResult(result)) {
      throw new BadRequestException({
        error: 'invalid_call_result',
        allowed: [
          'connected_meet_pending',
          'connected_qualified',
          'ring_no_answer',
          'unreachable',
          'wrong_number',
          'callback_requested',
          'connected_other',
        ],
      });
    }
    if (result === 'callback_requested' && !String(body.callback_at ?? '').trim()) {
      throw new BadRequestException({ error: 'callback_time_required' });
    }
    const channel = String(body.channel || 'phone').trim().toLowerCase() || 'phone';
    const startedAt = parseDate(body.started_at, new Date());
    const row = await this.repo.getLeadSlaRow(leadId);
    if (!row) throw new NotFoundException({ error: 'lead_not_found' });

    const config = await this.caseConfig();
    const retryGap = await this.retryGapHours(config.case_1b.min_gap_working_hours);
    config.case_1b = { ...config.case_1b, min_gap_working_hours: retryGap };
    const before = this.rowToSnapshot(row);

    const recentAttempts = await this.repo.listAttempts(leadId, 20);
    const lastPhone = recentAttempts.find(
      (a) => a.channel === 'phone' && a.counts_toward_sla && !a.warn_call_too_soon,
    );
    const gap = evaluateCallGap({
      lastCallAt: lastPhone ? new Date(lastPhone.started_at) : null,
      now: startedAt,
      minGapWorkingHours: config.case_1b.min_gap_working_hours,
    });
    if (channel === 'phone' && gap.blocked) {
      throw new BadRequestException({
        error: gap.message,
        code: 'call_too_soon',
        elapsed_minutes: gap.elapsedMinutes,
        next_allowed_at: gap.nextAllowedAt?.toISOString() ?? null,
        min_gap_working_hours: gap.minGapWorkingHours,
      });
    }
    const lastSame = recentAttempts.find((a) => {
      if (a.channel !== channel || a.call_result !== result) return false;
      if (body.staff_id != null && a.staff_id != null && Number(a.staff_id) !== Number(body.staff_id)) {
        return false;
      }
      return true;
    });
    const dup = evaluateDuplicateLog({
      previousAt: lastSame ? new Date(lastSame.started_at) : null,
      now: startedAt,
    });
    if (dup.blocked) {
      throw new BadRequestException({
        error: dup.message,
        code: 'call_duplicate',
        elapsed_minutes: dup.elapsedMinutes,
        next_allowed_at: dup.nextAllowedAt?.toISOString() ?? null,
      });
    }
    const lastAny = recentAttempts[0] ? new Date(recentAttempts[0].started_at) : null;
    const burst = evaluateDuplicateLog({ previousAt: lastAny, now: startedAt });
    if (burst.blocked) {
      const clock = formatCallGapRetryAt(burst.nextAllowedAt ?? startedAt, startedAt);
      throw new BadRequestException({
        error: `Bạn vừa ghi một liên hệ (cách dưới ${ACTIVITY_DEDUPE_MINUTES} phút) — chưa ghi thêm. Thử lại sau ${clock}.`,
        code: 'call_burst',
        elapsed_minutes: burst.elapsedMinutes,
        next_allowed_at: burst.nextAllowedAt?.toISOString() ?? null,
      });
    }

    const recomputed = applyCallLogToSnapshot(
      before,
      {
        call_result: result as LeadCallResult,
        channel,
        started_at: startedAt,
        meeting_at: body.meeting_at != null ? parseDate(body.meeting_at, startedAt) : undefined,
        callback_at:
          body.callback_at != null ? parseDate(body.callback_at, startedAt) : undefined,
        wrong_number_confirmed: Boolean(body.wrong_number_confirmed),
      },
      config,
    );

    const attemptNo = await this.repo.nextAttemptNo(leadId);
    const attempt = await this.repo.insertAttempt({
      leadId,
      attemptNo,
      staffId: body.staff_id != null ? Number(body.staff_id) : null,
      channel,
      startedAt,
      callResult: result,
      disposition: String(body.disposition ?? '').slice(0, 240),
      notes: String(body.notes ?? '').slice(0, 4000),
      durationSec: body.duration_sec != null ? Number(body.duration_sec) : null,
      countsTowardSla: recomputed.counts_toward_sla,
      countsTowardFr1: recomputed.counts_toward_fr1,
      warnCallTooSoon: false,
      createdBy: actor,
    });

    if (!recomputed.sla_frozen) {
      await this.repo.applySnapshot(
        leadId,
        recomputed.snapshot,
        startedAt,
        body.meeting_place ?? null,
      );
    }

    const activity = formatLeadCallActivity({
      callResult: result,
      channel,
      notes: body.notes,
      disposition: body.disposition,
      leadStatus: row.status == null ? '' : String(row.status),
      callbackAt: body.callback_at != null ? parseDate(body.callback_at, startedAt) : null,
    });
    await this.repo.recordLeadCallActivity({
      leadId,
      staffId: body.staff_id != null ? Number(body.staff_id) : null,
      content: activity.content,
      result: activity.result,
      createdBy: actor,
      at: startedAt,
    });

    if (channel === 'phone' && (result === 'ring_no_answer' || result === 'unreachable')) {
      // CHỜ GỌI LẠI: gọi lại sau N (team-SLA retry_gap_hours, mặc định 5 phút).
      await this.repo
        .setRetryCallAt(leadId, addWorkingHours(startedAt, retryGap, config.working_hours, config.holidays))
        .catch(() => undefined);
    }

    if (result === 'callback_requested') {
      const callbackAt = parseDate(body.callback_at, startedAt);
      const lead = await this.leads.getLeadById(leadId);
      const status = String(lead?.status ?? row.status ?? '').trim().toLowerCase();
      const flow = lead?.lead_flow_kind === 'b2b_prospect' ? 'b2b_prospect' : 'spa_operational';
      const note = String(body.notes ?? '').trim();
      const safeNote = note.length >= 3 ? note : 'Hẹn gọi lại';
      const nextCallAt = callbackAt.toISOString();
      if (isStatusTransitionAllowed(status, 'nurture', flow)) {
        await this.leadsWrite.patchLead(
          leadId,
          { status: 'nurture', audit_note: safeNote, next_call_at: nextCallAt },
          actor,
        );
      } else {
        await this.leadsWrite.patchLead(leadId, { next_call_at: nextCallAt }, actor);
      }
    }

    const sla = await this.readSla(leadId);
    return {
      sla,
      attempt,
      recompute: {
        counts_toward_fr1: recomputed.counts_toward_fr1,
        counts_toward_sla: recomputed.counts_toward_sla,
        warn_call_too_soon: false,
        sla_frozen: recomputed.sla_frozen,
      },
    };
  }
}
