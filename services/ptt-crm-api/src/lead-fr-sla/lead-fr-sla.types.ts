/**
 * P10.a — Lead First Response SLA: call results, contact status, hold recompute (pure).
 * LOCKED §15.2–15.5: hold_until null until first phone log; FR1 phone-only; clock=assigned_at.
 */

export const CALL_RESULTS = [
  'connected_meet_pending',
  'connected_qualified',
  'ring_no_answer',
  'unreachable',
  'wrong_number',
  'callback_requested',
  'connected_other',
] as const;

export type LeadCallResult = (typeof CALL_RESULTS)[number];

export const CONTACT_STATUSES = [
  'new',
  'attempting',
  'meet_pending',
  'meeting_booked',
  'callback_scheduled',
  'redistribute_queue',
  'reassigned',
  'invalid_contact',
  'unreachable_closed',
  'nurture',
  'disqualified',
] as const;

export type LeadContactStatus = (typeof CONTACT_STATUSES)[number];

export type LeadHoldReason =
  | ''
  | 'fr1'
  | 'fr_chain_1b'
  | 'fr_chain_1c'
  | 'meet_pending'
  | 'callback'
  | 'manual_extend'
  | 'hot_lead'
  | 'wrong_number';

export type LeadHoldProfile = '' | '1a' | '1b' | '1c' | 'callback' | 'invalid';

export type LeadFrSlaCaseConfig = {
  case_1a: {
    meeting_book_max_working_days: number;
    escalate_if_no_meeting_after_working_days: number;
    post_meeting_update_hours: number;
  };
  case_1b: {
    max_working_days: number;
    min_attempts: number;
    min_gap_working_hours: number;
    hot_max_working_days: number;
    hot_min_attempts: number;
    cooldown_days_same_am: number;
    max_extends: number;
    extend_working_days: number;
  };
  case_1c: {
    wrong_number_max_working_hours: number;
    unreachable_max_working_days: number;
    unreachable_min_attempts: number;
    max_reassign_rounds: number;
  };
  fr1_channels: string[];
  eligible_pipeline_stages: string[];
  working_hours: { days: number[]; start: string; end: string };
  holidays: string[];
};

export type LeadFrSlaSnapshot = {
  assigned_at: Date;
  fr1_due_at: Date | null;
  first_call_at: Date | null;
  fr1_breached: boolean;
  contact_status: string;
  hold_until: Date | null;
  hold_reason: string;
  hold_profile: string;
  attempts_since_assign: number;
  call_attempt_count: number;
  is_hot: boolean;
  meeting_at: Date | null;
  callback_at: Date | null;
  pipeline_stage: string;
  last_call_result: string;
};

export type CallLogInput = {
  call_result: LeadCallResult;
  channel: string;
  started_at: Date;
  counts_toward_sla?: boolean;
  meeting_at?: Date | null;
  callback_at?: Date | null;
  wrong_number_confirmed?: boolean;
};

export function isCallResult(value: string): value is LeadCallResult {
  return (CALL_RESULTS as readonly string[]).includes(value);
}

export function channelCountsTowardFr1(
  channel: string,
  fr1Channels: string[] = ['phone'],
): boolean {
  return fr1Channels.map((c) => c.toLowerCase()).includes(String(channel).toLowerCase());
}

export function isPipelineEligibleForSla(
  stage: string,
  eligible: string[],
): boolean {
  const s = String(stage || '').trim().toLowerCase();
  if (!s) return true; // empty status → treat as early funnel
  return eligible.map((x) => x.toLowerCase()).includes(s);
}

export function deriveHoldProfile(
  callResult: LeadCallResult,
  previousProfile: string,
): LeadHoldProfile {
  if (callResult === 'wrong_number') return 'invalid';
  if (callResult === 'callback_requested') return 'callback';
  if (callResult === 'connected_meet_pending') return '1a';
  if (
    callResult === 'connected_qualified' ||
    callResult === 'connected_other'
  ) {
    return '';
  }
  if (callResult === 'unreachable') return '1c';
  if (callResult === 'ring_no_answer') {
    if (previousProfile === '1c') return '1c';
    return '1b';
  }
  return (previousProfile as LeadHoldProfile) || '1b';
}
