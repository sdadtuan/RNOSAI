/**
 * Keep in sync with services/ptt-crm-api/src/leads-funnel/business-hours.util.ts (copied verbatim
 * below this header). The live calendar comes from GET /api/team-sla/business-calendar via
 * ensureBusinessCalendars() in ./business-calendar-api; until it loads, the default applies.
 */
/**
 * Business-hours clocks in Asia/Saigon (UTC+7).
 * Default calendar: 08:30-18:30, T2–T6. The Admin "Lead First Response SLA" config can override
 * the days, the shift and holidays (whole system and per team); BusinessCalendarService loads it
 * at startup, refreshes on publish/save and calls setBusinessCalendars(). Every function takes an
 * optional calendar; without one it uses the loaded default (or the built-in one above).
 */

export const BUSINESS_WORK_START = '08:30';
export const BUSINESS_WORK_END = '18:30';
export const BUSINESS_TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
/** Length of one default working day (08:30-18:30). */
export const BUSINESS_DAY_HOURS = 10;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
/** ~10 years of working minutes; anything larger is bad input. */
const MAX_BUSINESS_MINUTES = 10 * 260 * 10 * 60;
/** A calendar must have a working day within this many days (holidays included). */
const MAX_CALENDAR_SCAN_DAYS = 400;

export type BusinessCalendar = {
  /** ISO weekdays: 1 = T2 (Mon) … 7 = CN (Sun). */
  days: readonly number[];
  /** Shift start / end, minutes after midnight Asia/Saigon. */
  startMin: number;
  endMin: number;
  /** Non-working dates (YYYY-MM-DD, Asia/Saigon). */
  holidays: readonly string[];
};

export type BusinessCalendarGroup = 'sale_service' | 'marketing' | 'sale_real_estate';

export const DEFAULT_BUSINESS_CALENDAR: BusinessCalendar = Object.freeze({
  days: Object.freeze([1, 2, 3, 4, 5]),
  startMin: 8 * 60 + 30,
  endMin: 18 * 60 + 30,
  holidays: Object.freeze([] as string[]),
});

let defaultCalendar: BusinessCalendar = DEFAULT_BUSINESS_CALENDAR;
const groupCalendars = new Map<BusinessCalendarGroup, BusinessCalendar>();

/** Install the calendars loaded from settings (missing entries fall back to the default). */
export function setBusinessCalendars(input: {
  default?: BusinessCalendar | null;
  groups?: Partial<Record<BusinessCalendarGroup, BusinessCalendar | null>>;
}): void {
  defaultCalendar = input.default ?? DEFAULT_BUSINESS_CALENDAR;
  groupCalendars.clear();
  for (const [key, cal] of Object.entries(input.groups ?? {})) {
    if (cal) groupCalendars.set(key as BusinessCalendarGroup, cal);
  }
}

export function resetBusinessCalendars(): void {
  setBusinessCalendars({});
}

/** The loaded calendar for a team (Sale dịch vụ / Marketing / Sale BĐS), else the system default. */
export function businessCalendar(group?: BusinessCalendarGroup): BusinessCalendar {
  return (group ? groupCalendars.get(group) : undefined) ?? defaultCalendar;
}

/** Build a calendar from config ({days, start, end, holidays}); invalid / empty parts use the fallback. */
export function buildBusinessCalendar(
  raw: { days?: unknown; start?: unknown; end?: unknown; holidays?: unknown } | null | undefined,
  fallback: BusinessCalendar = DEFAULT_BUSINESS_CALENDAR,
): BusinessCalendar {
  const days = Array.isArray(raw?.days)
    ? [...new Set((raw?.days as unknown[]).map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))].sort(
        (a, b) => a - b,
      )
    : [];
  const start = parseClockMinutes(String(raw?.start ?? ''), -1);
  const end = parseClockMinutes(String(raw?.end ?? ''), -1);
  const window = start >= 0 && end > start;
  const holidays = Array.isArray(raw?.holidays)
    ? [
        ...new Set(
          (raw?.holidays as unknown[]).map((h) => String(h ?? '').trim().slice(0, 10)).filter((h) => YMD_RE.test(h)),
        ),
      ].sort()
    : [...fallback.holidays];
  return Object.freeze({
    days: Object.freeze(days.length ? days : [...fallback.days]),
    startMin: window ? start : fallback.startMin,
    endMin: window ? end : fallback.endMin,
    holidays: Object.freeze(holidays),
  });
}

/** Working hours in one day of this calendar. */
export function businessDayHours(cal: BusinessCalendar = businessCalendar()): number {
  return (cal.endMin - cal.startMin) / 60;
}

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

function ymdKey(parts: Pick<IctParts, 'year' | 'month' | 'day'>): string {
  return `${parts.year}-${String(parts.month + 1).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

/** Is this Asia/Saigon date a working day (weekday in the calendar and not a holiday)? */
export function isWorkingDay(
  parts: Pick<IctParts, 'year' | 'month' | 'day'>,
  cal: BusinessCalendar = businessCalendar(),
): boolean {
  const weekday = new Date(Date.UTC(parts.year, parts.month, parts.day)).getUTCDay();
  const iso = weekday === 0 ? 7 : weekday;
  if (!cal.days.includes(iso)) return false;
  return !cal.holidays.includes(ymdKey(parts));
}

export function nextWorkingDayAt(
  parts: IctParts,
  clockMinutes: number,
  cal: BusinessCalendar = businessCalendar(),
): Date {
  let cursor = addCalendarDays(parts, 1);
  for (let i = 0; i < MAX_CALENDAR_SCAN_DAYS; i += 1) {
    if (isWorkingDay(cursor, cal)) return ictDate(cursor.year, cursor.month, cursor.day, clockMinutes);
    cursor = addCalendarDays(cursor, 1);
  }
  throw new Error(`nextWorkingDayAt: no working day within ${MAX_CALENDAR_SCAN_DAYS} days (check days / holidays)`);
}

/** Saturday or Sunday (calendar-agnostic; prefer isWorkingDay). */
export function isWeekend(weekday: number): boolean {
  return weekday === 0 || weekday === 6;
}

export function isInsideBusinessHours(at: Date, cal: BusinessCalendar = businessCalendar()): boolean {
  const parts = ictParts(at);
  if (!isWorkingDay(parts, cal)) return false;
  return parts.minutes >= cal.startMin && parts.minutes < cal.endMin;
}

/** Move a moment to the start of the next (or current) working window. */
export function startOfBusinessWindow(from: Date, cal: BusinessCalendar = businessCalendar()): Date {
  const parts = ictParts(from);
  if (!isWorkingDay(parts, cal) || parts.minutes >= cal.endMin) {
    return nextWorkingDayAt(parts, cal.startMin, cal);
  }
  if (parts.minutes < cal.startMin) {
    return ictDate(parts.year, parts.month, parts.day, cal.startMin);
  }
  return from;
}

/**
 * Add working hours that only count the calendar's shift on its working days (Asia/Saigon).
 * Nights, days off and holidays do not consume the budget.
 */
export function addBusinessHours(from: Date, hours: number, cal: BusinessCalendar = businessCalendar()): Date {
  const remainingMinutes = Math.round(Number(hours) * 60);
  if (!Number.isFinite(remainingMinutes) || remainingMinutes <= 0) return new Date(from.getTime());
  let remaining = remainingMinutes;
  if (remaining > MAX_BUSINESS_MINUTES) {
    throw new RangeError(`addBusinessHours: ${hours}h exceeds the supported range`);
  }
  let cursor = startOfBusinessWindow(from, cal);
  // Each pass consumes one working window or jumps to the next one, so two passes per
  // working day (plus slack) always finish. Never truncate silently: throw if it does not.
  const dayMinutes = Math.max(1, cal.endMin - cal.startMin);
  const maxIterations = Math.ceil(remaining / dayMinutes) * 2 + 8;
  for (let i = 0; i < maxIterations; i += 1) {
    const parts = ictParts(cursor);
    if (!isWorkingDay(parts, cal) || parts.minutes >= cal.endMin) {
      cursor = nextWorkingDayAt(parts, cal.startMin, cal);
      continue;
    }
    if (parts.minutes < cal.startMin) {
      cursor = ictDate(parts.year, parts.month, parts.day, cal.startMin);
      continue;
    }
    const available = cal.endMin - parts.minutes;
    if (remaining <= available) {
      return new Date(cursor.getTime() + remaining * 60 * 1000);
    }
    remaining -= available;
    cursor = nextWorkingDayAt(parts, cal.startMin, cal);
  }
  throw new Error(`addBusinessHours: did not converge for ${hours}h from ${from.toISOString()}`);
}

/** Add working minutes (same window as addBusinessHours). */
export function addBusinessMinutes(from: Date, minutes: number, cal: BusinessCalendar = businessCalendar()): Date {
  return addBusinessHours(from, Number(minutes) / 60, cal);
}

/** Add whole business days (each day is one full shift of the calendar). */
export function addBusinessDays(from: Date, days: number, cal: BusinessCalendar = businessCalendar()): Date {
  return addBusinessHours(from, Number(days) * businessDayHours(cal), cal);
}

export function parseClockMinutes(raw: string | undefined, fallback: number): number {
  const m = TIME_RE.exec(String(raw ?? '').trim());
  if (!m) return fallback;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Accept clock ("Hạn nhận case"): in hours, now + minutes (if that passes the shift end, due at
 * shift start next working day). Off-hours / day off / holiday: due at shift start next working day.
 */
export function acceptDueAt(from: Date, minutes = 15, cal: BusinessCalendar = businessCalendar()): Date {
  const parts = ictParts(from);
  if (!isInsideBusinessHours(from, cal)) {
    if (isWorkingDay(parts, cal) && parts.minutes < cal.startMin) {
      return ictDate(parts.year, parts.month, parts.day, cal.startMin);
    }
    return nextWorkingDayAt(parts, cal.startMin, cal);
  }
  const plus = new Date(from.getTime() + Math.max(0, minutes) * 60 * 1000);
  const plusParts = ictParts(plus);
  if (
    plusParts.year !== parts.year ||
    plusParts.month !== parts.month ||
    plusParts.day !== parts.day ||
    plusParts.minutes > cal.endMin
  ) {
    return nextWorkingDayAt(parts, cal.startMin, cal);
  }
  return plus;
}

const DAY_SHORT = ['', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/** 510 -> "08:30". */
export function formatClockMinutes(min: number): string {
  const m = Math.max(0, Math.min(24 * 60, Math.round(Number(min) || 0)));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** ISO weekdays -> "T2–T6" (a run of 3+ days) or "T2, T4, T6". */
export function businessDaysLabel(days: readonly number[]): string {
  const sorted = [...new Set(days)].filter((d) => Number.isInteger(d) && d >= 1 && d <= 7).sort((a, b) => a - b);
  if (!sorted.length) return '';
  const contiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (contiguous && sorted.length > 2) return `${DAY_SHORT[sorted[0]]}–${DAY_SHORT[sorted[sorted.length - 1]]}`;
  return sorted.map((d) => DAY_SHORT[d]).join(', ');
}

/** "08:30–18:30 T2–T6" for clock / timeline messages. */
export function businessCalendarLabel(cal: BusinessCalendar = businessCalendar()): string {
  return `${formatClockMinutes(cal.startMin)}–${formatClockMinutes(cal.endMin)} ${businessDaysLabel(cal.days)}`.trim();
}

export type BusinessCalendarDto = { days: number[]; start: string; end: string; holidays: string[]; label: string };

/** JSON shape served to ops-web (GET /api/team-sla/business-calendar). */
export function businessCalendarDto(cal: BusinessCalendar = businessCalendar()): BusinessCalendarDto {
  return {
    days: [...cal.days],
    start: formatClockMinutes(cal.startMin),
    end: formatClockMinutes(cal.endMin),
    holidays: [...cal.holidays],
    label: businessCalendarLabel(cal),
  };
}

const CALENDAR_GROUPS: BusinessCalendarGroup[] = ['sale_service', 'marketing', 'sale_real_estate'];

/** Install the payload of GET /api/team-sla/business-calendar (bad parts fall back to defaults). */
export function applyBusinessCalendarPayload(body: unknown): void {
  const raw = (body && typeof body === 'object' ? body : {}) as {
    default?: { days?: unknown; start?: unknown; end?: unknown; holidays?: unknown } | null;
    groups?: Record<string, { days?: unknown; start?: unknown; end?: unknown; holidays?: unknown } | null>;
  };
  const def = buildBusinessCalendar(raw.default ?? null);
  const groups: Partial<Record<BusinessCalendarGroup, BusinessCalendar>> = {};
  for (const g of CALENDAR_GROUPS) {
    const entry = raw.groups?.[g];
    if (entry) groups[g] = buildBusinessCalendar(entry, def);
  }
  setBusinessCalendars({ default: def, groups });
}
