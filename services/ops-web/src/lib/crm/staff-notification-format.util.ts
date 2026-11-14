/** Strip raw “Mở lead: /crm/leads/…” from notify bodies — the Mở button already links. */
export function stripNotificationOpenLeadPath(body: string | null | undefined): string {
  return String(body ?? '')
    .replace(/\s*Mở lead:\s*\/crm\/leads\/\d+\.?/gi, '')
    .replace(/\s*Mở lead:\s*\/[^\s]+/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([.!?])/g, '$1')
    .trim();
}

/** Bell list timestamps: HH:mm dd/MM/yyyy in Asia/Saigon, no seconds. */
export function formatStaffNotificationAt(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Saigon',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  const hour = get('hour').padStart(2, '0');
  const minute = get('minute').padStart(2, '0');
  return `${hour}:${minute} ${get('day')}/${get('month')}/${get('year')}`;
}
