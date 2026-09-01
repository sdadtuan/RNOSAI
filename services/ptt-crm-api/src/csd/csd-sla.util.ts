import type { CsdSlaPolicySlice, CsdSlaStatus } from './csd.types';

const CSD_SLA_TZ = 'Asia/Ho_Chi_Minh';
const CSD_SLA_OFFSET = '+07:00';

const ISO_DOW: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

type LocalParts = {
  year: number;
  month: number;
  day: number;
  dow: number;
  minutes: number;
  dateKey: string;
};

function parseTime(value: string): number {
  const [hourRaw, minuteRaw] = value.split(':');
  return Number.parseInt(hourRaw, 10) * 60 + Number.parseInt(minuteRaw ?? '0', 10);
}

function localParts(d: Date): LocalParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: CSD_SLA_TZ,
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
    year,
    month,
    day,
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
    `${dateKey}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00${CSD_SLA_OFFSET}`,
  );
}

function isWorkingDay(dateKey: string, dow: number, policy: CsdSlaPolicySlice): boolean {
  return policy.workdays.includes(dow) && !policy.holidays.includes(dateKey);
}

function businessMsBetween(from: Date, to: Date, policy: CsdSlaPolicySlice): number {
  if (to <= from) return 0;

  const dayStartMin = parseTime(policy.workday_start);
  const dayEndMin = parseTime(policy.workday_end);
  let totalMs = 0;
  let cursor = from;

  while (cursor < to) {
    const parts = localParts(cursor);
    if (!isWorkingDay(parts.dateKey, parts.dow, policy)) {
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

    const segmentEnd = to < windowEnd ? to : windowEnd;
    if (segmentEnd > effectiveStart) {
      totalMs += segmentEnd.getTime() - effectiveStart.getTime();
    }

    if (segmentEnd >= to) break;
    cursor = makeLocalDate(nextDateKey(parts.dateKey), dayStartMin);
  }

  return totalMs;
}

export function policySliceFromRow(row: {
  workday_start: string;
  workday_end: string;
  workdays: number[];
  at_risk_pct: number;
  near_breach_pct: number;
  holidays?: string[];
}): CsdSlaPolicySlice {
  return {
    workday_start: String(row.workday_start).slice(0, 5),
    workday_end: String(row.workday_end).slice(0, 5),
    workdays: row.workdays,
    holidays: row.holidays ?? [],
    at_risk_pct: Number(row.at_risk_pct),
    near_breach_pct: Number(row.near_breach_pct),
  };
}

export function addBusinessMinutes(start: Date, minutes: number, policy: CsdSlaPolicySlice): Date {
  if (minutes <= 0) return start;

  const dayStartMin = parseTime(policy.workday_start);
  const dayEndMin = parseTime(policy.workday_end);
  let remaining = minutes;
  let cursor = start;

  while (remaining > 0) {
    const parts = localParts(cursor);
    if (!isWorkingDay(parts.dateKey, parts.dow, policy)) {
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

export function elapsedBusinessMs(
  from: Date,
  to: Date,
  policy: CsdSlaPolicySlice,
  pausedMs: number,
): number {
  const businessMs = businessMsBetween(from, to, policy);
  return Math.max(0, businessMs - pausedMs);
}

export function classifySlaStatus(
  usedPct: number,
  paused: boolean,
  policy?: Pick<CsdSlaPolicySlice, 'at_risk_pct' | 'near_breach_pct'>,
): CsdSlaStatus {
  if (paused) return 'paused';
  const atRisk = policy?.at_risk_pct ?? 70;
  const nearBreach = policy?.near_breach_pct ?? 90;
  if (usedPct >= 100) return 'breached';
  if (usedPct >= nearBreach) return 'near_breach';
  if (usedPct >= atRisk) return 'at_risk';
  return 'on_track';
}

export { CSD_SLA_TZ, localParts, makeLocalDate };
