import { addBusinessHours, addBusinessMinutes, startOfBusinessWindow } from './business-hours.util';

/** ICT instant: year, 1-based month, day, hour, minute. */
function ict(y: number, m: number, d: number, hh: number, mm: number): Date {
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - 7 * 60 * 60 * 1000);
}

describe('addBusinessHours', () => {
  it('adds two hours inside a weekday window', () => {
    // Wednesday 10:00 + 2h = 12:00
    const due = addBusinessHours(ict(2026, 11, 11, 10, 0), 2);
    expect(due.toISOString()).toBe(ict(2026, 11, 11, 12, 0).toISOString());
  });

  it('spills leftover minutes onto the next working morning', () => {
    // Wednesday 15:00 + 2h = 1h today + 1h Thursday 08:30 = 09:30
    const due = addBusinessHours(ict(2026, 11, 11, 15, 0), 2);
    expect(due.toISOString()).toBe(ict(2026, 11, 12, 9, 30).toISOString());
  });

  it('starts Monday 08:30 when the clock begins on a weekend', () => {
    // Saturday 11:00 + 2h = Monday 10:30
    const due = addBusinessHours(ict(2026, 11, 14, 11, 0), 2);
    expect(due.toISOString()).toBe(ict(2026, 11, 16, 10, 30).toISOString());
  });

  it('starts at 08:30 when the clock begins before the workday', () => {
    const due = addBusinessHours(ict(2026, 11, 11, 7, 0), 2);
    expect(due.toISOString()).toBe(ict(2026, 11, 11, 10, 30).toISOString());
  });

  it('skips from Friday after 16:00 to Monday', () => {
    const due = addBusinessHours(ict(2026, 11, 13, 16, 30), 2);
    expect(due.toISOString()).toBe(ict(2026, 11, 16, 10, 30).toISOString());
  });

  it('adds four hours across a day boundary (Solutions SLA)', () => {
    // Wednesday 14:00 + 4h = 2h today + 2h Thursday 08:30 = 10:30
    const due = addBusinessHours(ict(2026, 11, 11, 14, 0), 4);
    expect(due.toISOString()).toBe(ict(2026, 11, 12, 10, 30).toISOString());
  });

  it('adds 15 business minutes after close onto the next morning', () => {
    const due = addBusinessMinutes(ict(2026, 11, 11, 16, 0), 15);
    expect(due.toISOString()).toBe(ict(2026, 11, 12, 8, 45).toISOString());
  });

  it('startOfBusinessWindow is a no-op inside the window', () => {
    const at = ict(2026, 11, 11, 11, 15);
    expect(startOfBusinessWindow(at).toISOString()).toBe(at.toISOString());
  });
});
