import {
  buildBusinessCalendar,
  DEFAULT_BUSINESS_CALENDAR,
  type BusinessCalendar,
  type BusinessCalendarGroup,
} from '../leads-funnel/business-hours.util';
import type { SolutionWorkDueSettings } from '../leads-funnel/solution-case.util';
import type { TeamSlaDocument } from './team-sla-profiles';

export type BusinessCalendarSnapshot = {
  default: BusinessCalendar;
  groups: Partial<Record<BusinessCalendarGroup, BusinessCalendar>>;
  /** Marketing clocks: Mốc cắt, Trả Solutions trước/sau mốc cắt, Hạn sửa Solutions (giờ). */
  solution: SolutionWorkDueSettings;
};

const GROUPS: BusinessCalendarGroup[] = ['sale_service', 'marketing', 'sale_real_estate'];

function positiveNumber(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Admin "Lead First Response SLA" → calendars.
 * - System default: published working_hours (Ngày trong tuần, Giờ bắt đầu/kết thúc ca) + holidays.
 * - Per team (Sale dịch vụ / Marketing / Sale BĐS): that team's calendar; blank start/end or no days
 *   fall back to the system default. Holidays are shared.
 * Anything missing falls back to T2–T6 08:30–18:30.
 */
export function composeBusinessCalendars(
  leadSla: { working_hours?: { days?: unknown; start?: unknown; end?: unknown } | null; holidays?: unknown } | null,
  teamDoc: TeamSlaDocument | null,
): BusinessCalendarSnapshot {
  const base = buildBusinessCalendar(
    { ...(leadSla?.working_hours ?? {}), holidays: leadSla?.holidays ?? [] },
    DEFAULT_BUSINESS_CALENDAR,
  );
  const groups: BusinessCalendarSnapshot['groups'] = {};
  for (const code of GROUPS) {
    const profile = teamDoc?.profiles?.find((row) => row.code === code);
    if (!profile?.calendar) continue;
    groups[code] = buildBusinessCalendar({ ...profile.calendar, holidays: base.holidays }, base);
  }
  const marketing = teamDoc?.profiles?.find((row) => row.code === 'marketing');
  const clocks = marketing?.marketing;
  const solution: SolutionWorkDueSettings = {
    cutoffTime: clocks?.solution_cutoff_time || undefined,
    beforeCutoffHours:
      clocks?.solution_before_cutoff_hours == null ? undefined : Number(clocks.solution_before_cutoff_hours),
    afterCutoffTime: clocks?.solution_after_cutoff_time || undefined,
    workStartTime: marketing?.calendar?.start || undefined,
    revisionHours: positiveNumber(clocks?.revision_hours),
  };
  return { default: base, groups, solution };
}

type Listener = () => void;
const listeners = new Set<Listener>();

/** Subscribe to "SLA settings changed" (publish / team-SLA save). Returns an unsubscribe. */
export function onBusinessCalendarSourceChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Call after publishing lead-SLA settings or saving team SLA so the calendars reload now. */
export function notifyBusinessCalendarSourceChanged(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      /* a failed refresh keeps the previous calendars */
    }
  }
}
