export function monthlyRecurringVnd(opts: {
  billingType: string;
  amountVnd: number;
  startsOn: string | null;
  endsOn: string | null;
}): number | null {
  if (opts.billingType === 'media' || opts.billingType === 'media_spend') return null;
  if (opts.billingType === 'project' || opts.billingType === 'one_off') return null;
  if (opts.billingType === 'annual' || opts.billingType === 'yearly') {
    return Math.round(opts.amountVnd / 12);
  }
  return opts.amountVnd;
}

export function formatVnd(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '')} tỷ`;
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}tr`;
  return `${n.toLocaleString('vi-VN')} VND`;
}
