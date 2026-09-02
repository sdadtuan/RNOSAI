import type { CreateCsdReportScheduleInput, CsdReportScheduleRow } from './csd.types';

export type { CreateCsdReportScheduleInput, CsdReportScheduleRow };

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function utcYmd(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day));
}

export function periodForRecurrence(
  recurrence: string,
  now = new Date(),
): { period_start: string; period_end: string } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const day = now.getUTCDate();
  const dow = now.getUTCDay();

  if (recurrence === 'weekly') {
    const daysSinceMonday = (dow + 6) % 7;
    const thisMonday = utcYmd(y, m, day - daysSinceMonday);
    const prevMonday = utcYmd(
      thisMonday.getUTCFullYear(),
      thisMonday.getUTCMonth(),
      thisMonday.getUTCDate() - 7,
    );
    const prevSunday = utcYmd(
      prevMonday.getUTCFullYear(),
      prevMonday.getUTCMonth(),
      prevMonday.getUTCDate() + 6,
    );
    return { period_start: ymdUtc(prevMonday), period_end: ymdUtc(prevSunday) };
  }

  if (recurrence === 'monthly') {
    return {
      period_start: ymdUtc(utcYmd(y, m - 1, 1)),
      period_end: ymdUtc(utcYmd(y, m, 0)),
    };
  }

  if (recurrence === 'quarterly') {
    const prevQ = Math.floor(m / 3) - 1;
    const startYear = prevQ < 0 ? y - 1 : y;
    const startMonth = ((prevQ + 4) % 4) * 3;
    return {
      period_start: ymdUtc(utcYmd(startYear, startMonth, 1)),
      period_end: ymdUtc(utcYmd(startYear, startMonth + 3, 0)),
    };
  }

  throw new Error('unsupported_recurrence');
}

export async function tickCsdReportSchedules(deps: {
  claimDue: (limit: number) => Promise<CsdReportScheduleRow[]>;
  createDraft: (s: CsdReportScheduleRow) => Promise<{ id: string }>;
  notify: (staffId: number, reportId: string) => Promise<void>;
}): Promise<{ created: number }> {
  const due = await deps.claimDue(50);
  let created = 0;
  for (const schedule of due) {
    const draft = await deps.createDraft(schedule);
    if (schedule.owner_staff_id != null) {
      await deps.notify(schedule.owner_staff_id, draft.id);
    }
    created += 1;
  }
  return { created };
}
