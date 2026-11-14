import {
  acceptDueAt,
  addBusinessDays,
  addBusinessHours,
  addBusinessMinutes,
  startOfBusinessWindow,
} from './business-hours.util';

/** ICT instant: year, 1-based month, day, hour, minute. */
function ict(y: number, m: number, d: number, hh: number, mm: number): Date {
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - 7 * 60 * 60 * 1000);
}

describe('addBusinessHours (08:30-18:30 T2-T6 Asia/Saigon)', () => {
  it('adds two hours inside a weekday window', () => {
    const due = addBusinessHours(ict(2026, 11, 11, 10, 0), 2);
    expect(due.toISOString()).toBe(ict(2026, 11, 11, 12, 0).toISOString());
  });

  it('keeps Wednesday 15:00 + 2h on the same afternoon (17:00)', () => {
    const due = addBusinessHours(ict(2026, 11, 11, 15, 0), 2);
    expect(due.toISOString()).toBe(ict(2026, 11, 11, 17, 0).toISOString());
  });

  it('spills leftover minutes onto the next working morning after 18:30', () => {
    const due = addBusinessHours(ict(2026, 11, 11, 17, 0), 2);
    expect(due.toISOString()).toBe(ict(2026, 11, 12, 9, 0).toISOString());
  });

  it('starts Monday 08:30 when the clock begins on a weekend', () => {
    const due = addBusinessHours(ict(2026, 11, 14, 11, 0), 2);
    expect(due.toISOString()).toBe(ict(2026, 11, 16, 10, 30).toISOString());
  });

  it('starts at 08:30 when the clock begins before the workday', () => {
    const due = addBusinessHours(ict(2026, 11, 11, 7, 0), 2);
    expect(due.toISOString()).toBe(ict(2026, 11, 11, 10, 30).toISOString());
  });

  it('skips from Friday after 18:30 to Monday', () => {
    const due = addBusinessHours(ict(2026, 11, 13, 18, 45), 2);
    expect(due.toISOString()).toBe(ict(2026, 11, 16, 10, 30).toISOString());
  });

  it('adds four hours across a day boundary near close', () => {
    const due = addBusinessHours(ict(2026, 11, 11, 16, 0), 4);
    expect(due.toISOString()).toBe(ict(2026, 11, 12, 10, 0).toISOString());
  });

  it('adds 15 business minutes after close onto the next morning', () => {
    const due = addBusinessMinutes(ict(2026, 11, 11, 18, 30), 15);
    expect(due.toISOString()).toBe(ict(2026, 11, 12, 8, 45).toISOString());
  });

  it('addBusinessDays(1) is 10 working hours', () => {
    const due = addBusinessDays(ict(2026, 11, 11, 10, 0), 1);
    expect(due.toISOString()).toBe(ict(2026, 11, 12, 10, 0).toISOString());
  });

  it('startOfBusinessWindow is a no-op inside the window', () => {
    const at = ict(2026, 11, 11, 11, 15);
    expect(startOfBusinessWindow(at).toISOString()).toBe(at.toISOString());
  });
});

describe('acceptDueAt', () => {
  it('adds 15 minutes inside business hours', () => {
    expect(acceptDueAt(ict(2026, 11, 11, 10, 0)).toISOString()).toBe(
      ict(2026, 11, 11, 10, 15).toISOString(),
    );
  });

  it('is 08:30 next business day when already past 18:30', () => {
    expect(acceptDueAt(ict(2026, 11, 11, 19, 0)).toISOString()).toBe(
      ict(2026, 11, 12, 8, 30).toISOString(),
    );
  });

  it('is 08:30 Monday when starting on Saturday', () => {
    expect(acceptDueAt(ict(2026, 11, 14, 11, 0)).toISOString()).toBe(
      ict(2026, 11, 16, 8, 30).toISOString(),
    );
  });

  it('is 08:30 the same weekday when starting before 08:30', () => {
    expect(acceptDueAt(ict(2026, 11, 11, 7, 0)).toISOString()).toBe(
      ict(2026, 11, 11, 8, 30).toISOString(),
    );
  });

  it('crosses to 08:30 next morning if +15 minutes would pass 18:30', () => {
    expect(acceptDueAt(ict(2026, 11, 11, 18, 20)).toISOString()).toBe(
      ict(2026, 11, 12, 8, 30).toISOString(),
    );
  });
});
