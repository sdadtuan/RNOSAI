const AM_SLA_TZ = 'Asia/Ho_Chi_Minh';
const AM_SLA_OFFSET = '+07:00';

const ISO_DOW: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export type AmSlaCalendar = {
  workday_start: string;
  workday_end: string;
  workdays: number[];
  holidays: string[];
};

export type AmSlaDuesInput = AmSlaCalendar & {
  first_response_minutes: number;
  resolve_minutes: number;
};

type LocalParts = {
  dow: number;
  minutes: number;
  dateKey: string;
};

function parseTime(value: string): number {
  const [hourRaw, minuteRaw] = String(value).slice(0, 5).split(':');
  return Number.parseInt(hourRaw, 10) * 60 + Number.parseInt(minuteRaw ?? '0', 10);
}

function localParts(d: Date): LocalParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: AM_SLA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '0';
  const year = Number.parseInt(pick('year'), 10);
  const month = Number.parseInt(pick('month'), 10);
  const day = Number.parseInt(pick('day'), 10);
  return {
    dow: ISO_DOW[pick('weekday')] ?? 1,
    minutes: Number.parseInt(pick('hour'), 10) * 60 + Number.parseInt(pick('minute'), 10),
    dateKey: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
}

function nextDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

function makeLocalDate(dateKey: string, minutesFromMidnight: number): Date {
  const hour = Math.floor(minutesFromMidnight / 60);
  const minute = minutesFromMidnight % 60;
  return new Date(
    `${dateKey}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00${AM_SLA_OFFSET}`,
  );
}

function isWorkingDay(dateKey: string, dow: number, calendar: AmSlaCalendar): boolean {
  return calendar.workdays.includes(dow) && !calendar.holidays.includes(dateKey);
}

export function addAmBusinessMinutes(start: Date, minutes: number, calendar: AmSlaCalendar): Date {
  if (minutes <= 0) return start;

  const dayStartMin = parseTime(calendar.workday_start);
  const dayEndMin = parseTime(calendar.workday_end);
  let remaining = minutes;
  let cursor = start;

  while (remaining > 0) {
    const parts = localParts(cursor);
    if (!isWorkingDay(parts.dateKey, parts.dow, calendar)) {
      cursor = makeLocalDate(nextDateKey(parts.dateKey), dayStartMin);
      continue;
    }

    const windowStart = makeLocalDate(parts.dateKey, dayStartMin);
    const windowEnd = makeLocalDate(parts.dateKey, dayEndMin);
    const effectiveStart = cursor > windowStart ? cursor : windowStart;

    if (effectiveStart >= windowEnd) {
      cursor = makeLocalDate(nextDateKey(parts.dateKey), dayStartMin);
      continue;
    }

    const availableMin = (windowEnd.getTime() - effectiveStart.getTime()) / 60_000;
    const chunk = Math.min(remaining, availableMin);
    cursor = new Date(effectiveStart.getTime() + chunk * 60_000);
    remaining -= chunk;
  }

  return cursor;
}

export function computeAmSlaDues(
  start: Date,
  input: AmSlaDuesInput,
): { sla_first_due_at: string; sla_resolve_due_at: string } {
  return {
    sla_first_due_at: addAmBusinessMinutes(start, input.first_response_minutes, input).toISOString(),
    sla_resolve_due_at: addAmBusinessMinutes(start, input.resolve_minutes, input).toISOString(),
  };
}
