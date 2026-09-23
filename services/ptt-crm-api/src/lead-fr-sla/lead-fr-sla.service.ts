import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeadSlaSettingsService } from '../lead-sla-settings/lead-sla-settings.service';
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
  ) {}

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

  async readSla(leadId: number) {
    const row = await this.repo.getLeadSlaRow(leadId);
    if (!row) throw new NotFoundException({ error: 'lead_not_found' });
    const payload = await this.settings.getPublishedPayload();
    const snap = this.rowToSnapshot(row);
    const now = Date.now();
    const fr1DueMs = snap.fr1_due_at?.getTime() ?? null;
    const fr1Open = !snap.first_call_at && fr1DueMs != null;
    const fr1Overdue =
      snap.fr1_breached || (fr1Open && fr1DueMs != null && now > fr1DueMs);
    const attempts = await this.repo.listAttempts(leadId, 20);
    return {
      lead_id: leadId,
      settings_version: payload.settings_version,
      fr1_hours: payload.fr1_hours,
      fr1_channels: payload.fr1_channels,
      reassign_enabled: payload.feature_flags.lead_sla_reassign_enabled,
      assigned_at: snap.assigned_at.toISOString(),
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
    const channel = String(body.channel || 'phone').trim().toLowerCase() || 'phone';
    const startedAt = parseDate(body.started_at, new Date());
    const row = await this.repo.getLeadSlaRow(leadId);
    if (!row) throw new NotFoundException({ error: 'lead_not_found' });

    const config = await this.caseConfig();
    const before = this.rowToSnapshot(row);

    // Gap warn vs last phone attempt
    let warnTooSoon = false;
    const lastPhone = (await this.repo.listAttempts(leadId, 5)).find(
      (a) => a.channel === 'phone' && a.counts_toward_sla,
    );
    if (lastPhone && channel === 'phone') {
      const gapH = config.case_1b.min_gap_working_hours;
      const elapsedH =
        (startedAt.getTime() - new Date(lastPhone.started_at).getTime()) / 3600_000;
      if (elapsedH < gapH) warnTooSoon = true;
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

    const attemptNo = recomputed.snapshot.call_attempt_count || before.call_attempt_count + 1;
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
      warnCallTooSoon: warnTooSoon || recomputed.warn_call_too_soon,
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

    const sla = await this.readSla(leadId);
    return {
      sla,
      attempt,
      recompute: {
        counts_toward_fr1: recomputed.counts_toward_fr1,
        counts_toward_sla: recomputed.counts_toward_sla,
        warn_call_too_soon: warnTooSoon || recomputed.warn_call_too_soon,
        sla_frozen: recomputed.sla_frozen,
      },
    };
  }
}
