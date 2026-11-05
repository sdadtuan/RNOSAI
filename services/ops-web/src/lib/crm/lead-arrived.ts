/** When the lead arrived, in Vietnam time. Date-only values stay a date. */
export function formatLeadArrived(lead: {
  received_at?: string | null;
  created_at?: string | null;
}): string {
  const raw = String(lead.received_at || lead.created_at || '').trim();
  if (!raw) return '—';
  const hasClock = raw.includes('T') || raw.includes(':');
  const date = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10) || '—';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  const day = `${pick('year')}-${pick('month')}-${pick('day')}`;
  if (!hasClock) return day;
  return `${day} ${pick('hour')}:${pick('minute')}`;
}
