/**
 * P10.b — reassign eligibility (pure). Spec §7 + §15 + T2–T8.
 */

import type { LeadFrSlaCaseConfig } from './lead-fr-sla.types';
import { isPipelineEligibleForSla } from './lead-fr-sla.types';

export type ReassignLeadInput = {
  lead_id: number;
  owner_id: number | null;
  pipeline_stage: string;
  contact_status: string;
  hold_until: Date | null;
  hold_reason: string;
  hold_profile: string;
  last_call_result: string;
  attempts_since_assign: number;
  reassign_count: number;
  is_hot: boolean;
  meeting_at: Date | null;
  previous_assignee_ids: number[];
};

export type ReassignDecision =
  | { action: 'skip'; reason: string }
  | { action: 'nudge'; reason: string }
  | { action: 'escalate_1a'; reason: string }
  | { action: 'invalid_path'; reason: string }
  | { action: 'unreachable_closed'; reason: string }
  | { action: 'reassign'; reason: 'sla_hold_expired_1b' | 'sla_hold_expired_1c' };

const TERMINAL = new Set([
  'meeting_booked',
  'invalid_contact',
  'nurture',
  'disqualified',
  'unreachable_closed',
  'redistribute_queue',
]);

export function evaluateReassignDecision(
  lead: ReassignLeadInput,
  config: LeadFrSlaCaseConfig & {
    feature_flags?: { reassign_on_1a_timeout?: boolean };
  },
  now: Date = new Date(),
): ReassignDecision {
  if (lead.owner_id == null) {
    return { action: 'skip', reason: 'no_assignee' };
  }
  if (!isPipelineEligibleForSla(lead.pipeline_stage, config.eligible_pipeline_stages)) {
    return { action: 'skip', reason: 'pipeline_frozen' };
  }
  if (lead.hold_until == null) {
    return { action: 'skip', reason: 'hold_until_null' };
  }
  if (lead.hold_until.getTime() > now.getTime()) {
    return { action: 'skip', reason: 'hold_not_due' };
  }

  const status = String(lead.contact_status || '').toLowerCase();
  const result = String(lead.last_call_result || '').toLowerCase();
  const profile = String(lead.hold_profile || lead.hold_reason || '').toLowerCase();

  // T5 — wrong_number: never reassign (check before terminal skip)
  if (result === 'wrong_number' || status === 'invalid_contact' || profile === 'invalid') {
    return { action: 'invalid_path', reason: 'wrong_number_no_reassign' };
  }

  if (TERMINAL.has(status) && status !== 'redistribute_queue') {
    return { action: 'skip', reason: `terminal_${status || 'empty'}` };
  }

  // T7 — 1a meet_pending: escalate only (unless flag)
  const is1a =
    result === 'connected_meet_pending' ||
    status === 'meet_pending' ||
    profile === '1a' ||
    lead.hold_reason === 'meet_pending';
  if (is1a) {
    if (config.feature_flags?.reassign_on_1a_timeout) {
      return { action: 'reassign', reason: 'sla_hold_expired_1b' };
    }
    return { action: 'escalate_1a', reason: '1a_timeout_escalate' };
  }

  // 1c unreachable
  const is1c =
    result === 'unreachable' ||
    profile === '1c' ||
    lead.hold_reason === 'fr_chain_1c';
  if (is1c) {
    const minAtt = config.case_1c.unreachable_min_attempts;
    if (lead.attempts_since_assign < minAtt) {
      return { action: 'nudge', reason: 'insufficient_attempts_1c' };
    }
    if (lead.reassign_count >= config.case_1c.max_reassign_rounds) {
      return { action: 'unreachable_closed', reason: 'max_reassign_rounds' };
    }
    return { action: 'reassign', reason: 'sla_hold_expired_1c' };
  }

  // 1b RNA / hot
  const is1b =
    result === 'ring_no_answer' ||
    profile === '1b' ||
    lead.hold_reason === 'fr_chain_1b' ||
    lead.hold_reason === 'hot_lead' ||
    status === 'attempting' ||
    status === 'callback_scheduled';

  if (is1b) {
    const minAtt = lead.is_hot
      ? config.case_1b.hot_min_attempts
      : config.case_1b.min_attempts;
    if (lead.attempts_since_assign < minAtt) {
      return { action: 'nudge', reason: 'insufficient_attempts_1b' };
    }
    return { action: 'reassign', reason: 'sla_hold_expired_1b' };
  }

  return { action: 'skip', reason: 'no_matching_profile' };
}

export type PoolCandidate = {
  staff_id: number;
  open_attempting: number;
  accepts_leads: boolean;
  active: boolean;
};

/**
 * Round-robin least-open: exclude previous assignees still in cooldown window.
 * previous_assignee_ids: staff ids blocked; cooldownAts optional map staff_id → last reassign ISO.
 */
export function pickRoundRobinLeastOpen(
  candidates: PoolCandidate[],
  previousAssigneeIds: number[],
  opts: {
    maxOpen: number;
    cooldownDays: number;
    now?: Date;
    previousAtByStaff?: Record<number, string>;
  },
): number | null {
  const now = opts.now ?? new Date();
  const cooldownMs = opts.cooldownDays * 24 * 3600_000;
  const blocked = new Set(previousAssigneeIds.map(Number));

  const eligible = candidates
    .filter((c) => c.active && c.accepts_leads)
    .filter((c) => c.open_attempting < opts.maxOpen)
    .filter((c) => {
      if (!blocked.has(c.staff_id)) return true;
      const at = opts.previousAtByStaff?.[c.staff_id];
      if (!at) return false; // blocked without timestamp → still cooldown
      const t = new Date(at).getTime();
      if (Number.isNaN(t)) return false;
      return now.getTime() - t >= cooldownMs;
    })
    .sort((a, b) => a.open_attempting - b.open_attempting || a.staff_id - b.staff_id);

  return eligible[0]?.staff_id ?? null;
}

/** Queue alert when redistribute_queue age > max wait working hours (wall approx). */
export function shouldAlertQueueWait(
  queuedAt: Date | null,
  maxWaitWorkingHours: number,
  now: Date = new Date(),
): boolean {
  if (!queuedAt || !(maxWaitWorkingHours > 0)) return false;
  const elapsedH = (now.getTime() - queuedAt.getTime()) / 3600_000;
  return elapsedH >= maxWaitWorkingHours;
}
