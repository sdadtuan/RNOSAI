import { addWorkingDays } from '../lead-fr-sla/lead-fr-sla-hold.util';

export type PreB2HoldKind = 'no_answer' | 'busy' | 'callback';
export type PreB2HoldExpiry = 'none' | 'nudge' | 'reassign' | 'fail' | 'review';
export type PreB2HoldState = {
  kind: PreB2HoldKind | null;
  insideHold: boolean;
  holdUntil: Date | null;
  expiry: PreB2HoldExpiry;
};

const WORKING_HOURS = { days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' };

const NO_ANSWER = new Set(['ring_no_answer', 'no_answer', 'khong_nghe_may']);
const BUSY = new Set(['unreachable', 'khong_goi_duoc', 'khong_lien_lac_duoc']);
const CALLBACK = new Set(['callback_requested', 'callback', 'khach_hen_goi_lai']);
const ANSWERED = new Set([
  'answered',
  'connected_meet_pending',
  'connected_qualified',
  'connected_other',
]);

const NONE: PreB2HoldState = { kind: null, insideHold: false, holdUntil: null, expiry: 'none' };

export function preB2HoldState(input: {
  lastCallResult: string | null | undefined;
  assignedAt: Date;
  callbackAt: Date | null;
  lastCallAt: Date | null;
  attemptsSinceAssign: number;
  reassignCount: number;
  isHot: boolean;
  now: Date;
}): PreB2HoldState {
  const result = String(input.lastCallResult ?? '').trim().toLowerCase();
  if (!result || ANSWERED.has(result)) return NONE;

  const kind: PreB2HoldKind | null = NO_ANSWER.has(result)
    ? 'no_answer'
    : BUSY.has(result)
      ? 'busy'
      : CALLBACK.has(result)
        ? 'callback'
        : null;
  if (!kind) return NONE;

  if (kind === 'callback' && !input.callbackAt) {
    return { kind: 'callback', insideHold: false, holdUntil: null, expiry: 'none' };
  }

  const holdUntil = computeHoldUntil(kind, input);
  const insideHold = holdUntil.getTime() > input.now.getTime();
  if (insideHold) return { kind, insideHold: true, holdUntil, expiry: 'none' };

  return { kind, insideHold: false, holdUntil, expiry: expiryAfterHold(kind, input) };
}

function computeHoldUntil(
  kind: PreB2HoldKind,
  input: {
    assignedAt: Date;
    callbackAt: Date | null;
    isHot: boolean;
  },
): Date {
  if (kind === 'no_answer') {
    return addWorkingDays(input.assignedAt, input.isHot ? 2 : 3, WORKING_HOURS, []);
  }
  if (kind === 'busy') {
    return addWorkingDays(input.assignedAt, 2, WORKING_HOURS, []);
  }
  const fromAssign = addWorkingDays(input.assignedAt, 3, WORKING_HOURS, []);
  const afterAppointment = addWorkingDays(input.callbackAt as Date, 1, WORKING_HOURS, []);
  return new Date(Math.max(fromAssign.getTime(), afterAppointment.getTime()));
}

function expiryAfterHold(
  kind: PreB2HoldKind,
  input: {
    callbackAt: Date | null;
    lastCallAt: Date | null;
    attemptsSinceAssign: number;
    reassignCount: number;
    isHot: boolean;
  },
): PreB2HoldExpiry {
  if (kind === 'callback') {
    const appointment = input.callbackAt?.getTime() ?? 0;
    const last = input.lastCallAt?.getTime() ?? 0;
    if (!input.lastCallAt || last <= appointment) return 'review';
    return 'none';
  }
  if (kind === 'busy') {
    if (input.attemptsSinceAssign < 3) return 'nudge';
    if (input.reassignCount >= 1) return 'fail';
    return 'reassign';
  }
  const minAttempts = input.isHot ? 4 : 5;
  return input.attemptsSinceAssign >= minAttempts ? 'reassign' : 'nudge';
}
