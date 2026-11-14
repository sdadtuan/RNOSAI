import { describe, expect, it } from 'vitest';
import { defaultTeamSlaDocument } from './team-sla-profiles';
import { formatNewLeadOverdueLabel, resolveNewLeadClock } from './new-lead-clock';

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

  it('uses 08:30 next working morning when the lead arrives after the shift', () => {
    const clock = resolveNewLeadClock({
      document: doc,
      assignedAt: '2026-11-03T12:00:00.000Z',
      now: new Date('2026-11-03T12:00:00.000Z'),
    });
    expect(clock.phase).toBe('claim');
    expect(clock.label).toBe('Chưa nhận · nhận trước 08:30 04/11');
    expect(clock.dueAt).toBe('2026-11-04T01:30:00.000Z');
  });

  it('starts the 1 hour business-hours update clock only after the lead is claimed', () => {
    const clock = resolveNewLeadClock({
      document: doc,
      assignedAt: '2026-11-03T03:00:00.000Z',
      claimedAt: '2026-11-03T03:10:00.000Z',
      now: new Date('2026-11-03T03:10:00.000Z'),
    });
    expect(clock.phase).toBe('update');
    expect(clock.dueAt).toBe('2026-11-03T04:10:00.000Z');
    expect(clock.label).toBe('Đã nhận · cập nhật trước 11:10 03/11');
    expect(clock.detail).toContain('1 giờ');
    expect(clock.detail).not.toMatch(/\d{2}:\d{2}:\d{2}/);
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
    // 20:41 ICT = 13:41 UTC, after 18:30. 1 business hour: 08:30–09:30 next day = 02:30 UTC.
    const claimedAt = '2026-11-12T13:41:00.000Z';
    const clock = resolveNewLeadClock({
      document: doc,
      assignedAt: '2026-11-12T13:30:00.000Z',
      claimedAt,
      now: new Date(claimedAt),
    });
    expect(clock.phase).toBe('update');
    expect(clock.dueAt).toBe('2026-11-13T02:30:00.000Z');
    expect(clock.label).toBe('Đã nhận · cập nhật trước 09:30 13/11');
    expect(clock.detail).toContain('1 giờ');
    expect(clock.detail).toMatch(/10:30 13\/11/);
    expect(clock.detail).not.toMatch(/22:41/);
    expect(clock.detail).not.toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('labels an in-shift unclaimed lead with the short claim due line', () => {
    const assignedAt = '2026-11-03T03:00:00.000Z';
    const clock = resolveNewLeadClock({
      document: doc,
      assignedAt,
      now: new Date(assignedAt),
    });
    expect(clock.label).toBe('Chưa nhận · nhận trước 10:15 03/11');
    expect(clock.detail).not.toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('formats a short overdue label without seconds', () => {
    expect(formatNewLeadOverdueLabel(45_000)).toBe('Trễ 1 phút');
    expect(formatNewLeadOverdueLabel(20 * 60_000)).toBe('Trễ 20 phút');
    expect(formatNewLeadOverdueLabel(2 * 60 * 60_000 + 15 * 60_000)).toBe('Trễ 2 giờ 15 phút');
  });
});
