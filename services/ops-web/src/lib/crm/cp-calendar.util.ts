export const CP_DEFAULT_TZ = 'Asia/Ho_Chi_Minh';
export const CP_PUBLISH_KIND = 'video' as const;

export const CP_CALENDAR_TABS = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'composer', label: 'Composer' },
  { id: 'gate', label: 'Gate' },
] as const;

export type CpCalendarTab = (typeof CP_CALENDAR_TABS)[number]['id'];
export type CpCalendarView = 'month' | 'week' | 'list';

export type CpCalendarItem = {
  id: string;
  scheduled_at?: string | null;
  channel?: string | null;
  draft_name?: string | null;
  kind?: string | null;
};

export type CpMonthCell = {
  date: string;
  day: number;
  inMonth: boolean;
  weekday: number;
  items: CpCalendarItem[];
};

export function calendarItemKind(item: {
  video_version_id?: string | null;
  content_item_id?: string | null;
  kind?: string | null;
}): 'video' | 'copy' {
  if (item.kind === 'copy' || (item.content_item_id && !item.video_version_id)) return 'copy';
  return 'video';
}

export function isPublishLocked(version: {
  approval_status?: string | null;
  qc_status?: string | null;
}): boolean {
  return version.approval_status !== 'final_approved' || version.qc_status === 'blocked';
}

export function toTzDate(value: string, tz = CP_DEFAULT_TZ): string | null {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed);
}

export function buildMonthCells(
  year: number,
  month: number,
  items: CpCalendarItem[],
  tz = CP_DEFAULT_TZ,
): CpMonthCell[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const jsDay = first.getUTCDay();
  const mondayOffset = jsDay === 0 ? 6 : jsDay - 1;
  const start = new Date(first);
  start.setUTCDate(1 - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const iso = date.toISOString().slice(0, 10);
    const weekday = ((date.getUTCDay() + 6) % 7) + 1;
    return {
      date: iso,
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === month - 1,
      weekday,
      items: items.filter((item) => {
        if (calendarItemKind(item) !== 'video' || !item.scheduled_at) return false;
        return toTzDate(item.scheduled_at, tz) === iso;
      }),
    };
  });
}
