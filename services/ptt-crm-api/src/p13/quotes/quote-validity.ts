const SAIGON = 'Asia/Ho_Chi_Minh';

export function saigonDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SAIGON, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Calendar days in Asia/Saigon, weekends and holidays included. */
export function addCalendarDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const next = new Date(Date.UTC(year!, (month ?? 1) - 1, (day ?? 1) + days));
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, '0');
  const d = String(next.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatViDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

export function isExpired(today: string, validUntil: string | null): boolean {
  if (!validUntil) return false;
  return today > validUntil.slice(0, 10);
}
