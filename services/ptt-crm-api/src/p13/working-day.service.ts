/** Calendar working days: Monday–Friday minus crm_holidays. Not the lead SLA hour counter. */

const WEEKEND = new Set([0, 6]);

export function parseIsoDate(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) throw new Error(`invalid_date:${iso}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`invalid_date:${iso}`);
  }
  return date;
}

export function formatIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export class WorkingDayService {
  constructor(private readonly holidays: ReadonlySet<string> = new Set()) {}

  isWorkingDay(iso: string): boolean {
    const date = parseIsoDate(iso);
    if (WEEKEND.has(date.getUTCDay())) return false;
    return !this.holidays.has(formatIsoDate(date));
  }

  /** N1 is day 1. If `start` is not a working day, day 1 is the next working day. */
  addWorkingDays(start: string, days: number): string {
    if (!Number.isInteger(days) || days < 1) throw new Error('working_days_positive');
    let cursor = parseIsoDate(start);
    let left = days;
    for (let guard = 0; guard < 3660; guard += 1) {
      const iso = formatIsoDate(cursor);
      if (this.isWorkingDay(iso)) {
        left -= 1;
        if (left === 0) return iso;
      }
      cursor = addDays(cursor, 1);
    }
    throw new Error('working_days_overflow');
  }

  /** Inclusive count of working days from `start` through `end`. */
  workingDaysBetween(start: string, end: string): number {
    let cursor = parseIsoDate(start);
    const last = parseIsoDate(end);
    if (cursor.getTime() > last.getTime()) return 0;
    let count = 0;
    for (let guard = 0; guard < 3660; guard += 1) {
      if (this.isWorkingDay(formatIsoDate(cursor))) count += 1;
      if (cursor.getTime() === last.getTime()) return count;
      cursor = addDays(cursor, 1);
    }
    throw new Error('working_days_overflow');
  }
}
