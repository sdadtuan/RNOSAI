/** Business-hours clocks in Asia/Saigon (UTC+7): 08:30-18:30, Monday-Friday only. */

export const BUSINESS_WORK_START = '08:30';
export const BUSINESS_WORK_END = '18:30';
export const BUSINESS_TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
/** Length of one working day (08:30-18:30). */
export const BUSINESS_DAY_HOURS = 10;

const WORK_START_MIN = 8 * 60 + 30;
const WORK_END_MIN = 18 * 60 + 30;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
/** ~10 years of working minutes; anything larger is bad input. */
const MAX_BUSINESS_MINUTES = 10 * 260 * 10 * 60;

export type IctParts = {
  year: number;
  month: number;
  day: number;
  weekday: number;
  minutes: number;
};

export function ictParts(date: Date): IctParts {
  const shifted = new Date(date.getTime() + BUSINESS_TZ_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

export function ictDate(year: number, month: number, day: number, minutes: number): Date {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return new Date(Date.UTC(year, month, day, hours, mins) - BUSINESS_TZ_OFFSET_MS);
}

function addCalendarDays(
  parts: Pick<IctParts, 'year' | 'month' | 'day'>,
  days: number,
): Pick<IctParts, 'year' | 'month' | 'day'> {
  const next = new Date(Date.UTC(parts.year, parts.month, parts.day + days));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth(), day: next.getUTCDate() };
}

export function nextWorkingDayAt(parts: IctParts, clockMinutes: number): Date {
  let cursor = addCalendarDays(parts, 1);
  let weekday = new Date(Date.UTC(cursor.year, cursor.month, cursor.day)).getUTCDay();
  while (weekday === 0 || weekday === 6) {
    cursor = addCalendarDays(cursor, 1);
    weekday = new Date(Date.UTC(cursor.year, cursor.month, cursor.day)).getUTCDay();
  }
  return ictDate(cursor.year, cursor.month, cursor.day, clockMinutes);
}

export function isWeekend(weekday: number): boolean {
  return weekday === 0 || weekday === 6;
}

export function isInsideBusinessHours(at: Date): boolean {
  const parts = ictParts(at);
  if (isWeekend(parts.weekday)) return false;
  return parts.minutes >= WORK_START_MIN && parts.minutes < WORK_END_MIN;
}

/** Move a moment to the start of the next (or current) working window. */
export function startOfBusinessWindow(from: Date): Date {
  const parts = ictParts(from);
  if (isWeekend(parts.weekday) || parts.minutes >= WORK_END_MIN) {
    return nextWorkingDayAt(parts, WORK_START_MIN);
  }
  if (parts.minutes < WORK_START_MIN) {
    return ictDate(parts.year, parts.month, parts.day, WORK_START_MIN);
  }
  return from;
}

/**
 * Add working hours that only count 08:30-18:30 on weekdays (Asia/Saigon).
 * Nights and weekends do not consume the budget.
 */
export function addBusinessHours(from: Date, hours: number): Date {
  const remainingMinutes = Math.round(Number(hours) * 60);
  if (!Number.isFinite(remainingMinutes) || remainingMinutes <= 0) return new Date(from.getTime());
  let remaining = remainingMinutes;
  if (remaining > MAX_BUSINESS_MINUTES) {
    throw new RangeError(`addBusinessHours: ${hours}h exceeds the supported range`);
  }
  let cursor = startOfBusinessWindow(from);
  // Each pass consumes one working window or jumps to the next one, so two passes per
  // working day (plus slack) always finish. Never truncate silently: throw if it does not.
  const maxIterations = Math.ceil(remaining / (BUSINESS_DAY_HOURS * 60)) * 2 + 8;
  for (let i = 0; i < maxIterations; i += 1) {
    const parts = ictParts(cursor);
    if (isWeekend(parts.weekday) || parts.minutes >= WORK_END_MIN) {
      cursor = nextWorkingDayAt(parts, WORK_START_MIN);
      continue;
    }
    if (parts.minutes < WORK_START_MIN) {
      cursor = ictDate(parts.year, parts.month, parts.day, WORK_START_MIN);
      continue;
    }
    const available = WORK_END_MIN - parts.minutes;
    if (remaining <= available) {
      return new Date(cursor.getTime() + remaining * 60 * 1000);
    }
    remaining -= available;
    cursor = nextWorkingDayAt(parts, WORK_START_MIN);
  }
  throw new Error(`addBusinessHours: did not converge for ${hours}h from ${from.toISOString()}`);
}

/** Add working minutes (same window as addBusinessHours). */
export function addBusinessMinutes(from: Date, minutes: number): Date {
  return addBusinessHours(from, Number(minutes) / 60);
}

/** Add whole business days (each day is 08:30-18:30 = 10 working hours). */
export function addBusinessDays(from: Date, days: number): Date {
  return addBusinessHours(from, Number(days) * BUSINESS_DAY_HOURS);
}

export function parseClockMinutes(raw: string | undefined, fallback: number): number {
  const m = TIME_RE.exec(String(raw ?? '').trim());
  if (!m) return fallback;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * 15-minute accept clock: in hours, now + minutes (if that crosses 18:30, due 08:30 next business day).
 * Off-hours / weekend: due 08:30 next business day (not 08:45).
 */
export function acceptDueAt(from: Date, minutes = 15): Date {
  const parts = ictParts(from);
  if (!isInsideBusinessHours(from)) {
    if (!isWeekend(parts.weekday) && parts.minutes < WORK_START_MIN) {
      return ictDate(parts.year, parts.month, parts.day, WORK_START_MIN);
    }
    return nextWorkingDayAt(parts, WORK_START_MIN);
  }
  const plus = new Date(from.getTime() + Math.max(0, minutes) * 60 * 1000);
  const plusParts = ictParts(plus);
  if (
    plusParts.year !== parts.year ||
    plusParts.month !== parts.month ||
    plusParts.day !== parts.day ||
    plusParts.minutes > WORK_END_MIN
  ) {
    return nextWorkingDayAt(parts, WORK_START_MIN);
  }
  return plus;
}
