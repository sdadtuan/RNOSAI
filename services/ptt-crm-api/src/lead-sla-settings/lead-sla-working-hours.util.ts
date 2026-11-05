/**
 * Working-hours calendar helpers for P10 FR1 (Asia/Saigon = UTC+7 wall clock).
 * Spec days: 1=Mon … 7=Sun.
 */

export interface WorkingHoursConfig {
  days: number[];
  start: string; // HH:MM
  end: string;
}

const SAIGON_OFFSET_MS = 7 * 60 * 60 * 1000;

function parseHm(hm: string): { h: number; m: number } {
  const [h, m] = String(hm)
    .split(':')
    .map((x) => Number(x));
  return { h: Number.isFinite(h) ? h : 0, m: Number.isFinite(m) ? m : 0 };
}

function saigonParts(d: Date): {
  y: number;
  mo: number;
  day: number;
  h: number;
  mi: number;
  jsDay: number;
} {
  const local = new Date(d.getTime() + SAIGON_OFFSET_MS);
  return {
    y: local.getUTCFullYear(),
    mo: local.getUTCMonth(),
    day: local.getUTCDate(),
    h: local.getUTCHours(),
    mi: local.getUTCMinutes(),
    jsDay: local.getUTCDay(),
  };
}

function fromSaigon(y: number, mo: number, day: number, h: number, mi: number): Date {
  return new Date(Date.UTC(y, mo, day, h, mi, 0, 0) - SAIGON_OFFSET_MS);
}

function ymdSaigon(d: Date): string {
  const p = saigonParts(d);
  return `${p.y}-${String(p.mo + 1).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function isWorkingDay(d: Date, days: number[], holidays: Set<string>): boolean {
  if (holidays.has(ymdSaigon(d))) return false;
  const jsDay = saigonParts(d).jsDay; // 0 Sun
  const specDay = jsDay === 0 ? 7 : jsDay;
  return days.includes(specDay) || days.includes(jsDay);
}

function startOfWorkingDay(d: Date, start: string): Date {
  const p = saigonParts(d);
  const { h, m } = parseHm(start);
  return fromSaigon(p.y, p.mo, p.day, h, m);
}

function endOfWorkingDay(d: Date, end: string): Date {
  const p = saigonParts(d);
  const { h, m } = parseHm(end);
  return fromSaigon(p.y, p.mo, p.day, h, m);
}

function nextCalendarDayStart(d: Date, start: string): Date {
  const p = saigonParts(d);
  const next = fromSaigon(p.y, p.mo, p.day + 1, 12, 0);
  return startOfWorkingDay(next, start);
}

/**
 * Add N working hours from `from`, skipping non-working days / holidays / outside window.
 */
export function addWorkingHours(
  from: Date,
  hours: number,
  config: WorkingHoursConfig,
  holidays: string[] = [],
): Date {
  if (!(hours > 0) || !Number.isFinite(hours)) return new Date(from);
  const holidaySet = new Set(holidays.map((h) => String(h).slice(0, 10)));
  let cursor = new Date(from);
  let remainingMs = hours * 3600_000;
  let guard = 0;

  while (remainingMs > 0 && guard < 10_000) {
    guard += 1;
    if (!isWorkingDay(cursor, config.days, holidaySet)) {
      cursor = nextCalendarDayStart(cursor, config.start);
      continue;
    }
    const dayStart = startOfWorkingDay(cursor, config.start);
    const dayEnd = endOfWorkingDay(cursor, config.end);
    if (cursor < dayStart) {
      cursor = dayStart;
      continue;
    }
    if (cursor >= dayEnd) {
      cursor = nextCalendarDayStart(cursor, config.start);
      continue;
    }
    const available = dayEnd.getTime() - cursor.getTime();
    if (remainingMs <= available) {
      return new Date(cursor.getTime() + remainingMs);
    }
    remainingMs -= available;
    cursor = nextCalendarDayStart(cursor, config.start);
  }
  return cursor;
}

export function computeFr1DueAt(
  assignedAt: Date,
  fr1Hours: number,
  config: WorkingHoursConfig,
  holidays: string[] = [],
): Date {
  return addWorkingHours(assignedAt, fr1Hours, config, holidays);
}

/** True if `at` falls inside working window (Saigon wall + holidays). */
export function isWithinWorkingHours(
  at: Date,
  config: WorkingHoursConfig,
  holidays: string[] = [],
): boolean {
  const holidaySet = new Set(holidays.map((h) => String(h).slice(0, 10)));
  if (!isWorkingDay(at, config.days, holidaySet)) return false;
  const dayStart = startOfWorkingDay(at, config.start);
  const dayEnd = endOfWorkingDay(at, config.end);
  return at >= dayStart && at < dayEnd;
}

/** Working hours between `from` and `to` (0 if to <= from). */
export function workingHoursBetween(
  from: Date,
  to: Date,
  config: WorkingHoursConfig,
  holidays: string[] = [],
): number {
  if (to.getTime() <= from.getTime()) return 0;
  const holidaySet = new Set(holidays.map((h) => String(h).slice(0, 10)));
  let cursor = new Date(from);
  let accMs = 0;
  let guard = 0;
  while (cursor < to && guard < 10_000) {
    guard += 1;
    if (!isWorkingDay(cursor, config.days, holidaySet)) {
      cursor = nextCalendarDayStart(cursor, config.start);
      continue;
    }
    const dayStart = startOfWorkingDay(cursor, config.start);
    const dayEnd = endOfWorkingDay(cursor, config.end);
    if (cursor < dayStart) {
      cursor = dayStart;
      continue;
    }
    if (cursor >= dayEnd) {
      cursor = nextCalendarDayStart(cursor, config.start);
      continue;
    }
    const sliceEnd = to < dayEnd ? to : dayEnd;
    accMs += Math.max(0, sliceEnd.getTime() - cursor.getTime());
    cursor = sliceEnd.getTime() >= dayEnd.getTime()
      ? nextCalendarDayStart(cursor, config.start)
      : to;
  }
  return accMs / 3600_000;
}

export function addWorkingDays(
  from: Date,
  days: number,
  config: WorkingHoursConfig,
  holidays: string[] = [],
): Date {
  const { h: sh, m: sm } = parseHm(config.start);
  const { h: eh, m: em } = parseHm(config.end);
  const hoursPerDay = Math.max(1, eh + em / 60 - (sh + sm / 60));
  return addWorkingHours(from, days * hoursPerDay, config, holidays);
}

/** Subtract working hours by binary-searching a past start that advances to `from`. */
export function subtractWorkingHours(
  from: Date,
  hours: number,
  config: WorkingHoursConfig,
  holidays: string[] = [],
): Date {
  if (!(hours > 0)) return new Date(from);
  let lo = new Date(from.getTime() - Math.ceil(hours / 6) * 7 * 24 * 3600_000);
  let hi = new Date(from);
  for (let i = 0; i < 32; i += 1) {
    const mid = new Date((lo.getTime() + hi.getTime()) / 2);
    const advanced = addWorkingHours(mid, hours, config, holidays);
    if (advanced.getTime() >= from.getTime()) hi = mid;
    else lo = mid;
  }
  return hi;
}

export function subtractWorkingDays(
  from: Date,
  days: number,
  config: WorkingHoursConfig,
  holidays: string[] = [],
): Date {
  const { h: sh, m: sm } = parseHm(config.start);
  const { h: eh, m: em } = parseHm(config.end);
  const hoursPerDay = Math.max(1, eh + em / 60 - (sh + sm / 60));
  return subtractWorkingHours(from, days * hoursPerDay, config, holidays);
}
