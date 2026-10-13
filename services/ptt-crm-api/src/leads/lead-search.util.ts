/** Digits to match a phone search. Names stay a text search. */
export function leadSearchPhoneDigits(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const compact = text.replace(/[\s+\-().]/g, '');
  if (!/^\d+$/.test(compact) || compact.length < 8) return null;
  let digits = compact;
  if (digits.startsWith('84') && digits.length >= 10) digits = `0${digits.slice(2)}`;
  return digits.slice(-9);
}

export function isIsoDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}
