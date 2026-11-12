import { describe, expect, it } from 'vitest';
import { defaultTeamSlaDocument } from './team-sla-profiles';
import { resolveNewLeadClock } from './new-lead-clock';

const doc = defaultTeamSlaDocument();

describe('resolveNewLeadClock', () => {
  it('gives 15 minutes to claim a lead assigned inside the shift', () => {
    const assignedAt = '2026-11-03T03:00:00.000Z';
    const clock = resolveNewLeadClock({
      document: doc,
      assignedAt,
      now: new Date(assignedAt),
    });
    expect(clock.phase).toBe('claim');
    expect(clock.dueAt).toBe('2026-11-03T03:15:00.000Z');
    expect(clock.overdue).toBe(false);
  });

  it('uses 09:00 next working morning when the lead arrives after the shift', () => {
    const clock = resolveNewLeadClock({
      document: doc,
      assignedAt: '2026-11-03T12:00:00.000Z',
      now: new Date('2026-11-03T12:00:00.000Z'),
    });
    expect(clock.phase).toBe('claim');
    expect(clock.label).toBe('Nhận lead ngoài ca');
    expect(clock.dueAt).toBe('2026-11-04T02:00:00.000Z');
  });

  it('starts the 2 hour business-hours update clock only after the lead is claimed', () => {
    const clock = resolveNewLeadClock({
      document: doc,
      assignedAt: '2026-11-03T03:00:00.000Z',
      claimedAt: '2026-11-03T03:10:00.000Z',
      now: new Date('2026-11-03T03:10:00.000Z'),
    });
    expect(clock.phase).toBe('update');
    expect(clock.dueAt).toBe('2026-11-03T05:10:00.000Z');
    expect(clock.detail).toContain('2 giờ');
  });

  it('closes the new-lead clock after the first call is logged', () => {
    const clock = resolveNewLeadClock({
      document: doc,
      assignedAt: '2026-11-03T03:00:00.000Z',
      claimedAt: '2026-11-03T03:10:00.000Z',
      firstCallAt: '2026-11-03T03:40:00.000Z',
      now: new Date('2026-11-03T03:40:00.000Z'),
    });
    expect(clock.phase).toBe('done');
    expect(clock.overdue).toBe(false);
  });


  it('closes the clock when B2 / first-contact is already completed, even without a logged first call', () => {
    const clock = resolveNewLeadClock({
      document: doc,
      assignedAt: '2026-11-12T15:15:23.000Z',
      claimedAt: '2026-11-12T15:15:30.000Z',
      now: new Date('2026-11-12T15:30:00.000Z'),
      completed: true,
    });
    expect(clock.phase).toBe('done');
    expect(clock.overdue).toBe(false);
    expect(clock.remainingMs).toBeNull();
    expect(clock.dueAt).toBeNull();
  });

  it('keeps the 15-minute claim clock running for a fresh unclaimed lead', () => {
    const assignedAt = '2026-11-12T03:00:00.000Z';
    const clock = resolveNewLeadClock({
      document: doc,
      assignedAt,
      now: new Date(assignedAt),
      completed: false,
    });
    expect(clock.phase).toBe('claim');
    expect(clock.dueAt).toBe('2026-11-12T03:15:00.000Z');
  });

  it('puts the after-hours reassign deadline on the next working morning, not wall-clock', () => {
    // 20:41 ICT = 13:41 UTC, after 16:00. 2 business hours: 08:30–10:30 next day = 03:30 UTC.
    const claimedAt = '2026-11-12T13:41:00.000Z';
    const clock = resolveNewLeadClock({
      document: doc,
      assignedAt: '2026-11-12T13:30:00.000Z',
      claimedAt,
      now: new Date(claimedAt),
    });
    expect(clock.phase).toBe('update');
    expect(clock.dueAt).toBe('2026-11-13T03:30:00.000Z');
    expect(clock.detail).toMatch(/10:30/);
    expect(clock.detail).not.toMatch(/22:41/);
  });

});
