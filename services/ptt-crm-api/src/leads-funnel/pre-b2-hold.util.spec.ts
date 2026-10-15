import { preB2HoldState } from './pre-b2-hold.util';

const assigned = new Date('2026-10-12T02:00:00.000Z'); // 09:00 thứ Hai ICT

describe('preB2HoldState', () => {
  it('keeps a missed call inside a 3 working-day hold', () => {
    const state = preB2HoldState({
      lastCallResult: 'no_answer',
      assignedAt: assigned,
      callbackAt: null,
      lastCallAt: assigned,
      attemptsSinceAssign: 1,
      reassignCount: 0,
      isHot: false,
      now: new Date('2026-10-13T02:00:00.000Z'),
    });
    expect(state.kind).toBe('no_answer');
    expect(state.insideHold).toBe(true);
    expect(state.expiry).toBe('none');
    expect(state.holdUntil?.toISOString()).toBe('2026-10-14T11:00:00.000Z');
  });

  it('nudges a missed call that expired before 5 attempts', () => {
    const state = preB2HoldState({
      lastCallResult: 'ring_no_answer',
      assignedAt: assigned,
      callbackAt: null,
      lastCallAt: assigned,
      attemptsSinceAssign: 2,
      reassignCount: 0,
      isHot: false,
      now: new Date('2026-10-15T02:00:00.000Z'),
    });
    expect(state.insideHold).toBe(false);
    expect(state.expiry).toBe('nudge');
  });

  it('reassigns a missed call after 5 attempts', () => {
    const state = preB2HoldState({
      lastCallResult: 'no_answer',
      assignedAt: assigned,
      callbackAt: null,
      lastCallAt: assigned,
      attemptsSinceAssign: 5,
      reassignCount: 0,
      isHot: false,
      now: new Date('2026-10-15T02:00:00.000Z'),
    });
    expect(state.expiry).toBe('reassign');
  });

  it('uses 2 working days and 4 attempts for a hot missed call', () => {
    const early = preB2HoldState({
      lastCallResult: 'no_answer',
      assignedAt: assigned,
      callbackAt: null,
      lastCallAt: assigned,
      attemptsSinceAssign: 4,
      reassignCount: 0,
      isHot: true,
      now: new Date('2026-10-13T06:00:00.000Z'),
    });
    expect(early.insideHold).toBe(true);
    const due = preB2HoldState({
      ...earlyInput(assigned),
      isHot: true,
      attemptsSinceAssign: 4,
      now: new Date('2026-10-14T02:00:00.000Z'),
    });
    expect(due.expiry).toBe('reassign');
  });

  it('fails a busy lead after one reassign round', () => {
    const state = preB2HoldState({
      lastCallResult: 'unreachable',
      assignedAt: assigned,
      callbackAt: null,
      lastCallAt: assigned,
      attemptsSinceAssign: 3,
      reassignCount: 1,
      isHot: false,
      now: new Date('2026-10-14T02:00:00.000Z'),
    });
    expect(state.kind).toBe('busy');
    expect(state.expiry).toBe('fail');
  });

  it('sends an overdue callback with no new call to review', () => {
    const callbackAt = new Date('2026-10-16T02:00:00.000Z');
    const state = preB2HoldState({
      lastCallResult: 'callback',
      assignedAt: assigned,
      callbackAt,
      lastCallAt: assigned,
      attemptsSinceAssign: 1,
      reassignCount: 0,
      isHot: false,
      now: new Date('2026-10-19T02:00:00.000Z'),
    });
    expect(state.kind).toBe('callback');
    expect(state.expiry).toBe('review');
  });

  it('clears the hold after the customer answers', () => {
    const state = preB2HoldState({
      lastCallResult: 'answered',
      assignedAt: assigned,
      callbackAt: null,
      lastCallAt: assigned,
      attemptsSinceAssign: 1,
      reassignCount: 0,
      isHot: false,
      now: assigned,
    });
    expect(state).toEqual({ kind: null, insideHold: false, holdUntil: null, expiry: 'none' });
  });
});

function earlyInput(assignedAt: Date) {
  return {
    lastCallResult: 'no_answer',
    assignedAt,
    callbackAt: null,
    lastCallAt: assignedAt,
    attemptsSinceAssign: 1,
    reassignCount: 0,
    isHot: false,
    now: assignedAt,
  };
}
