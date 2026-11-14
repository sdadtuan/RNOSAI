import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addBusinessHours,
  applyBusinessCalendarPayload,
  businessCalendar,
  resetBusinessCalendars,
} from './business-hours';
import { ensureBusinessCalendars, resetBusinessCalendarCache } from './business-calendar-api';
import { resolveNewLeadClock } from './new-lead-clock';

const SHORT_DAY = {
  default: { days: [1, 2, 3, 4, 5], start: '08:30', end: '18:30', holidays: [] },
  groups: { sale_service: { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00', holidays: [] } },
};

afterEach(() => {
  resetBusinessCalendars();
  resetBusinessCalendarCache();
  vi.unstubAllGlobals();
});

describe('ops-web business calendar from the API', () => {
  it('countdowns follow the backend calendar', () => {
    applyBusinessCalendarPayload(SHORT_DAY);
    expect(businessCalendar('sale_service').startMin).toBe(9 * 60);
    const fri1630 = new Date('2026-11-13T09:30:00.000Z'); // Fri 16:30 ICT
    // 30 min left Friday, 30 min Monday from 09:00.
    expect(addBusinessHours(fri1630, 1, businessCalendar('sale_service')).toISOString()).toBe('2026-11-16T02:30:00.000Z');
    const clock = resolveNewLeadClock({ assignedAt: fri1630.toISOString(), claimedAt: fri1630.toISOString(), now: fri1630 });
    expect(clock.phase).toBe('update');
    expect(clock.dueAt).toBe('2026-11-16T02:30:00.000Z');
    expect(clock.detail).toContain('09:00–17:00 T2–T6');
  });

  it('bad payload keeps the default 08:30–18:30', () => {
    applyBusinessCalendarPayload(null);
    expect(businessCalendar('marketing').startMin).toBe(8 * 60 + 30);
    expect(businessCalendar('marketing').endMin).toBe(18 * 60 + 30);
  });

  it('fetches once per TTL and survives API errors', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => SHORT_DAY }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await ensureBusinessCalendars('t', 1_000)).toBe(true);
    expect(await ensureBusinessCalendars('t', Date.now() + 1_000)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain('/api/team-sla/business-calendar');
    resetBusinessCalendarCache();
    resetBusinessCalendars();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    expect(await ensureBusinessCalendars('t')).toBe(false);
    expect(businessCalendar('sale_service').startMin).toBe(8 * 60 + 30);
  });
});
