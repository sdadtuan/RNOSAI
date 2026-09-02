import { IWR_DAILY_DUE_HOUR, IWR_TZ, type IwrPeriod, type IwrTemplateCode } from './iwr.types';

export function vnYmd(now: Date, tz = IWR_TZ): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function parseYmd(ymd: string): Date {
  return new Date(`${ymd}T12:00:00+07:00`);
}

function formatYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(ymd: string, days: number): string {
  const d = parseYmd(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return formatYmd(d);
}

function weekdayVn(ymd: string): number {
  return parseYmd(ymd).getUTCDay();
}

export function isIwrWorkday(ymd: string): boolean {
  const day = weekdayVn(ymd);
  return day >= 1 && day <= 5;
}

function dueAtFromYmd(ymd: string, hour = IWR_DAILY_DUE_HOUR): string {
  return `${ymd}T${String(hour).padStart(2, '0')}:00:00.000+07:00`;
}

function mondayOfWeek(ymd: string): string {
  const day = weekdayVn(ymd);
  const offset = day === 0 ? 6 : day - 1;
  return addDays(ymd, -offset);
}

function lastDayOfMonth(ymd: string): string {
  const d = parseYmd(ymd);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const last = new Date(Date.UTC(y, m + 1, 0));
  return formatYmd(last);
}

function lastWorkdayOfMonth(ymd: string): string {
  let cur = lastDayOfMonth(ymd);
  while (!isIwrWorkday(cur)) {
    cur = addDays(cur, -1);
  }
  return cur;
}

export function iwrPeriodForTemplate(code: IwrTemplateCode, now: Date): IwrPeriod {
  const today = vnYmd(now, IWR_TZ);

  if (code === 'daily_work') {
    return {
      period_start: today,
      period_end: today,
      due_at: dueAtFromYmd(today),
    };
  }

  if (code === 'weekly_work') {
    const mon = mondayOfWeek(today);
    const fri = addDays(mon, 4);
    return {
      period_start: mon,
      period_end: fri,
      due_at: dueAtFromYmd(fri),
    };
  }

  const d = parseYmd(today);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const first = formatYmd(new Date(Date.UTC(y, m, 1)));
  const lastWork = lastWorkdayOfMonth(today);
  return {
    period_start: first,
    period_end: lastWork,
    due_at: dueAtFromYmd(lastWork),
  };
}

export function isIwrLate(submittedAt: Date, dueAt: Date): boolean {
  return submittedAt.getTime() > dueAt.getTime();
}
