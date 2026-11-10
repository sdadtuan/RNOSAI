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

  it('starts the 1 hour update clock only after the lead is claimed', () => {
    const clock = resolveNewLeadClock({
      document: doc,
      assignedAt: '2026-11-03T03:00:00.000Z',
      claimedAt: '2026-11-03T03:10:00.000Z',
      now: new Date('2026-11-03T03:10:00.000Z'),
    });
    expect(clock.phase).toBe('update');
    expect(clock.dueAt).toBe('2026-11-03T04:10:00.000Z');
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
});
