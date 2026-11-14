import { formatHistoryClock } from '@/lib/crm/lead-history';

/** Compact remaining time without seconds, e.g. "Còn 7h 59p" or "Quá hạn 1n 2h 10p". */
export function formatCompactCountdown(remainingMs: number): string {
  const abs = Math.abs(remainingMs);
  const totalMinutes = Math.max(0, Math.floor(abs / 60_000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}n`);
  if (hours) parts.push(`${hours}h`);
  if (minutes || parts.length === 0) parts.push(`${minutes}p`);
  const clock = parts.join(' ');
  return remainingMs < 0 ? `Quá hạn ${clock}` : `Còn ${clock}`;
}

/** Due stamp without seconds: "03:09 15/11/2026". */
export function formatCompactDueStamp(iso: string | null | undefined): string {
  return formatHistoryClock(iso);
}

/** One-line SLA without seconds: "Hạn phản hồi khách · Còn 7h 59p (03:09 15/11/2026)". */
export function formatCompactSlaLine(
  label: string,
  remainingMs: number,
  dueAt: string | null | undefined,
): string {
  const title = String(label ?? '').trim() || 'Hạn';
  const due = formatCompactDueStamp(dueAt);
  const remain = formatCompactCountdown(remainingMs);
  return due ? `${title} · ${remain} (${due})` : `${title} · ${remain}`;
}
