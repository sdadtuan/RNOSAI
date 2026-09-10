import { dash } from './cp-format';

export const CP_DEFAULT_TZ = 'Asia/Ho_Chi_Minh';
export const CP_PUBLISH_KIND = 'video' as const;

export const CP_CALENDAR_TABS = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'composer', label: 'Composer' },
  { id: 'gate', label: 'Gate' },
  { id: 'distribution', label: 'Phân phối' },
  { id: 'bulk', label: 'Lịch hàng loạt' },
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

export type ComposerSchedulableVersion = {
  schedulable?: boolean | null;
  eligible?: boolean | null;
  approval_status?: string | null;
  qc_status?: string | null;
  rights_status?: 'ok' | 'warn' | 'block' | null;
  disclaimer_present?: boolean | null;
  lock_reason?: string | null;
};

export function isCpPublishNative(settings: { publish_native?: boolean | null } | null): boolean {
  return settings?.publish_native === true;
}

export function distributionPostLabel(
  item: { post_ref?: string | null; status?: string | null },
  nativeEnabled: boolean,
): string {
  const ref = String(item.post_ref ?? '').trim();
  if (!ref) return dash(null);
  if (ref.startsWith('export:')) return `Xuất file · ${ref}`;
  if (ref.startsWith('native:')) {
    if (!nativeEnabled) return dash(null);
    const channel = ref.split(':')[1] ?? 'channel';
    return `Native ${channel} · ${ref}`;
  }
  if (!nativeEnabled) return dash(null);
  return ref;
}

export function isComposerSchedulable(version: ComposerSchedulableVersion): boolean {
  if (typeof version.schedulable === 'boolean') return version.schedulable;
  if (version.approval_status !== 'final_approved') return false;
  if (version.qc_status === 'blocked') return false;
  if (version.rights_status === 'block') return false;
  if (version.disclaimer_present === false) return false;
  if (version.rights_status === undefined || version.disclaimer_present === undefined) {
    return false;
  }
  return true;
}

export function datetimeLocalInTz(local: string, tz = CP_DEFAULT_TZ): string {
  const text = String(local ?? '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text);
  if (!match) {
    const parsed = Date.parse(text);
    if (!Number.isFinite(parsed)) throw new Error('invalid_scheduled_at');
    return new Date(parsed).toISOString();
  }
  const naiveUtc = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] ?? 0),
  );
  const offset = tzOffsetMs(new Date(naiveUtc), tz);
  const utc = naiveUtc - tzOffsetMs(new Date(naiveUtc - offset), tz);
  return new Date(utc).toISOString();
}

function tzOffsetMs(instant: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) => (
    Number(parts.find((part) => part.type === type)?.value ?? '0')
  );
  const hour = read('hour') === 24 ? 0 : read('hour');
  const asLocal = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    hour,
    read('minute'),
    read('second'),
  );
  return asLocal - instant.getTime();
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
