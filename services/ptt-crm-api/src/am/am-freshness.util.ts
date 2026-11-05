const ICT_TZ = 'Asia/Ho_Chi_Minh';
const WORK_START_MIN = 8 * 60 + 30;
const WORK_END_MIN = 17 * 60 + 30;
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

const ISO_DOW: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

function ictParts(now: Date): { dow: number; minutes: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: ICT_TZ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '0';
  return {
    dow: ISO_DOW[pick('weekday')] ?? 1,
    minutes: Number.parseInt(pick('hour'), 10) * 60 + Number.parseInt(pick('minute'), 10),
  };
}

function formatWorkLeft(remainingMin: number): string {
  if (remainingMin <= 0) return 'Giờ LV còn 0p';
  const hours = Math.floor(remainingMin / 60);
  const minutes = remainingMin % 60;
  if (hours > 0 && minutes === 0) return `Giờ LV còn ${hours}h`;
  if (hours > 0) return `Giờ LV còn ${hours}h${minutes}`;
  return `Giờ LV còn ${minutes}p`;
}

export function workLeftLabel(now: Date): string {
  const { dow, minutes } = ictParts(now);
  if (dow === 6 || dow === 7) return 'Ngoài giờ LV';
  if (minutes >= WORK_END_MIN) return 'Giờ LV còn 0p';
  const remaining = minutes < WORK_START_MIN ? WORK_END_MIN - WORK_START_MIN : WORK_END_MIN - minutes;
  return formatWorkLeft(remaining);
}

export function isStale(asOf: Date | string, now: Date, thresholdMs = STALE_AFTER_MS): boolean {
  const asOfMs = typeof asOf === 'string' ? Date.parse(asOf) : asOf.getTime();
  return now.getTime() - asOfMs > thresholdMs;
}
