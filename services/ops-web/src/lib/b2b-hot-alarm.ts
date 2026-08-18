export function shouldRingHotAlarm(input: {
  severity: string;
  inHours: boolean;
  leadOpen: boolean;
  elapsedMs: number;
}): boolean {
  if (input.leadOpen || !input.inHours) return false;
  if (input.severity !== 'urgent') return false;
  return input.elapsedMs < 30_000;
}

export function isB2bHotSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem('b2bHotSound') !== '0';
}

export function isB2bSalesInHours(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const wd = parts.find((p) => p.type === 'weekday')?.value;
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
  const day = map[wd ?? ''] ?? -1;
  if (![1, 2, 3, 4, 5, 6].includes(day)) return false;
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const cur = `${hour}:${minute}`;
  return cur >= '08:00' && cur < '18:00';
}

export function alertSeverityLabel(severity: string, kind: string): string {
  if (severity === 'urgent' || kind === 'assigned_hot') return 'Hot';
  if (kind === 'unassigned') return 'Chờ nhận';
  if (severity === 'inbox') return 'Inbox';
  return 'Thường';
}
