/** Catalog unit codes → Vietnamese labels on the quote sheet. */
const QUOTE_UNIT_VI: Record<string, string> = {
  times: 'lần',
  time: 'lần',
  month: 'tháng',
  months: 'tháng',
  shoot_day: 'ngày quay',
  day: 'ngày',
  days: 'ngày',
  hour: 'giờ',
  hours: 'giờ',
  week: 'tuần',
  weeks: 'tuần',
  package: 'gói',
  job: 'hạng mục',
  item: 'hạng mục',
  year: 'năm',
  years: 'năm',
};

export function quoteUnitLabel(unit: string | null | undefined): string {
  const raw = String(unit ?? '').trim();
  if (!raw) return '';
  return QUOTE_UNIT_VI[raw.toLowerCase()] ?? raw;
}

/** Role labels returned by older API builds (e.g. Account) → Vietnamese product terms. */
export function quoteRoleLabel(label: string | null | undefined): string {
  const raw = String(label ?? '').trim();
  if (!raw) return '';
  if (raw.toLowerCase() === 'account') return 'AM';
  return raw;
}
