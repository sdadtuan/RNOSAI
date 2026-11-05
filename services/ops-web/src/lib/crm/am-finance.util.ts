import { vnd } from './am-format';

export function amFinanceAmountDisplay(hidden: boolean, amount: number | null | undefined): string {
  if (hidden || amount == null) return '—';
  return vnd(amount);
}

export function amFinanceDash(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  return String(value);
}

export function amFinanceAging(days: number | null | undefined): string {
  if (days == null) return '—';
  return String(days);
}

export function amFinanceSyncCopy(source: string | null | undefined, lastSync: string | null | undefined): string {
  const src = source?.trim() || '—';
  if (!lastSync) return `Nguồn: ${src}`;
  const stamp = lastSync.length >= 19 ? lastSync.slice(0, 19).replace('T', ' ') : lastSync;
  return `Nguồn: ${src} · Last sync: ${stamp}`;
}
