import { addWorkingHours } from '../lead-sla-settings/lead-sla-working-hours.util';
import type {
  CallLogInput,
  LeadFrSlaCaseConfig,
  LeadFrSlaSnapshot,
  LeadHoldProfile,
  LeadHoldReason,
} from './lead-fr-sla.types';
import {
  channelCountsTowardFr1,
  deriveHoldProfile,
  isPipelineEligibleForSla,
} from './lead-fr-sla.types';

/** Add N full working days (same window start each day) after `from`. */
export function addWorkingDays(
  from: Date,
  days: number,
  config: LeadFrSlaCaseConfig['working_hours'],
  holidays: string[] = [],
): Date {
  if (!(days > 0)) return new Date(from);
  // Approximate: 1 WD = working_hours span (end-start) hours × days
  const [sh, sm] = config.start.split(':').map(Number);
  const [eh, em] = config.end.split(':').map(Number);
  const hoursPerDay = Math.max((eh + em / 60) - (sh + sm / 60), 1);
  return addWorkingHours(from, days * hoursPerDay, config, holidays);
}

export type RecomputeResult = {
  snapshot: LeadFrSlaSnapshot;
  hold_profile: LeadHoldProfile;
  counts_toward_fr1: boolean;
  counts_toward_sla: boolean;
  warn_call_too_soon: boolean;
  sla_frozen: boolean;
};

/**
 * Apply one call log onto a lead SLA snapshot (pure).
 * R3: hold_until stays null until first phone log that counts toward SLA.
 */
export function applyCallLogToSnapshot(
  before: LeadFrSlaSnapshot,
  input: CallLogInput,
  config: LeadFrSlaCaseConfig,
): RecomputeResult {
  const frozen = !isPipelineEligibleForSla(
    before.pipeline_stage,
    config.eligible_pipeline_stages,
  );

  const isPhoneFr1 = channelCountsTowardFr1(input.channel, config.fr1_channels);
  const countsTowardFr1 = isPhoneFr1;
  let countsTowardSla = input.counts_toward_sla !== false && isPhoneFr1;
  let warnCallTooSoon = false;

  // Gap warn (v1: warn + still count unless caller forced counts_toward_sla=false)
  if (
    countsTowardSla &&
    before.last_call_result &&
    before.attempts_since_assign > 0
  ) {
    // soft: we don't have last_call_at in minimal path — service sets gap flag
  }

  if (frozen) {
    // Historical fields may still update for audit, but hold frozen
    const snap: LeadFrSlaSnapshot = {
      ...before,
      last_call_result: input.call_result,
    };
    return {
      snapshot: snap,
      hold_profile: (before.hold_profile as LeadHoldProfile) || '',
      counts_toward_fr1: countsTowardFr1,
      counts_toward_sla: false,
      warn_call_too_soon: false,
      sla_frozen: true,
    };
  }

  let fr1Breached = before.fr1_breached;
  let firstCallAt = before.first_call_at;
  if (countsTowardFr1) {
    if (!firstCallAt) {
      firstCallAt = input.started_at;
      if (before.fr1_due_at && input.started_at.getTime() > before.fr1_due_at.getTime()) {
        fr1Breached = true;
      }
    }
  }

  const attemptsSince = countsTowardSla
    ? before.attempts_since_assign + 1
    : before.attempts_since_assign;
  const callAttemptCount = countsTowardSla
    ? before.call_attempt_count + 1
    : before.call_attempt_count;

  const profile = deriveHoldProfile(
    input.call_result,
    before.hold_profile,
  );

  let contactStatus = before.contact_status || 'new';
  let holdUntil: Date | null = before.hold_until;
  let holdReason: LeadHoldReason = (before.hold_reason as LeadHoldReason) || '';
  let meetingAt = input.meeting_at !== undefined ? input.meeting_at : before.meeting_at;
  let callbackAt = input.callback_at !== undefined ? input.callback_at : before.callback_at;

  // Non-phone: do not set hold_until (R5)
  if (!isPhoneFr1) {
    const snap: LeadFrSlaSnapshot = {
      ...before,
      first_call_at: firstCallAt,
      fr1_breached: fr1Breached,
      last_call_result: input.call_result,
      attempts_since_assign: attemptsSince,
      call_attempt_count: callAttemptCount,
    };
    return {
      snapshot: snap,
      hold_profile: (before.hold_profile as LeadHoldProfile) || '',
      counts_toward_fr1: false,
      counts_toward_sla: false,
      warn_call_too_soon: warnCallTooSoon,
      sla_frozen: false,
    };
  }

  // First phone log (or later): recompute hold
  switch (input.call_result) {
    case 'wrong_number': {
      contactStatus = input.wrong_number_confirmed ? 'invalid_contact' : 'attempting';
      holdUntil = addWorkingHours(
        input.started_at,
        config.case_1c.wrong_number_max_working_hours,
        config.working_hours,
        config.holidays,
      );
      holdReason = 'wrong_number';
      break;
    }
    case 'connected_meet_pending': {
      contactStatus = meetingAt ? 'meeting_booked' : 'meet_pending';
      if (meetingAt) {
        holdUntil = addWorkingHours(
          meetingAt,
          config.case_1a.post_meeting_update_hours,
          config.working_hours,
          config.holidays,
        );
        holdReason = 'meet_pending';
      } else {
        holdUntil = addWorkingDays(
          input.started_at,
          config.case_1a.meeting_book_max_working_days,
          config.working_hours,
          config.holidays,
        );
        holdReason = 'meet_pending';
      }
      break;
    }
    case 'callback_requested': {
      contactStatus = 'callback_scheduled';
      const base1b = addWorkingDays(
        before.assigned_at,
        before.is_hot ? config.case_1b.hot_max_working_days : config.case_1b.max_working_days,
        config.working_hours,
        config.holidays,
      );
      if (callbackAt) {
        const cbHold = addWorkingDays(callbackAt, 1, config.working_hours, config.holidays);
        holdUntil = new Date(Math.max(base1b.getTime(), cbHold.getTime()));
      } else {
        holdUntil = base1b;
      }
      holdReason = 'callback';
      break;
    }
    case 'unreachable': {
      contactStatus = 'attempting';
      holdUntil = addWorkingDays(
        before.assigned_at,
        config.case_1c.unreachable_max_working_days,
        config.working_hours,
        config.holidays,
      );
      holdReason = 'fr_chain_1c';
      break;
    }
    case 'ring_no_answer': {
      contactStatus = 'attempting';
      const days = before.is_hot
        ? config.case_1b.hot_max_working_days
        : config.case_1b.max_working_days;
      holdUntil = addWorkingDays(
        before.assigned_at,
        days,
        config.working_hours,
        config.holidays,
      );
      holdReason = before.is_hot ? 'hot_lead' : 'fr_chain_1b';
      break;
    }
    case 'connected_qualified':
    case 'connected_other': {
      contactStatus = 'attempting';
      // Connected clears hold urgency for reassign — keep hold as FR chain soft
      holdUntil = null;
      holdReason = '';
      break;
    }
    default:
      break;
  }

  // Before any phone log, hold must stay null — first phone log always sets above
  // (explicit: if somehow no case matched, leave previous)

  const snap: LeadFrSlaSnapshot = {
    ...before,
    first_call_at: firstCallAt,
    fr1_breached: fr1Breached,
    contact_status: contactStatus,
    hold_until: holdUntil,
    hold_reason: holdReason,
    hold_profile: profile,
    attempts_since_assign: attemptsSince,
    call_attempt_count: callAttemptCount,
    last_call_result: input.call_result,
    meeting_at: meetingAt ?? null,
    callback_at: callbackAt ?? null,
  };

  return {
    snapshot: snap,
    hold_profile: profile,
    counts_toward_fr1: countsTowardFr1,
    counts_toward_sla: countsTowardSla,
    warn_call_too_soon: warnCallTooSoon,
    sla_frozen: false,
  };
}

/** Initial state on assign — R3 hold_until NULL. */
export function initialSnapshotOnAssign(input: {
  assignedAt: Date;
  fr1DueAt: Date;
  isHot: boolean;
  pipelineStage: string;
}): LeadFrSlaSnapshot {
  return {
    assigned_at: input.assignedAt,
    fr1_due_at: input.fr1DueAt,
    first_call_at: null,
    fr1_breached: false,
    contact_status: 'new',
    hold_until: null,
    hold_reason: '',
    hold_profile: '',
    attempts_since_assign: 0,
    call_attempt_count: 0,
    is_hot: input.isHot,
    meeting_at: null,
    callback_at: null,
    pipeline_stage: input.pipelineStage,
    last_call_result: '',
  };
}
