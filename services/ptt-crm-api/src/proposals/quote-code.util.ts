export const QT_CODE_TZ = 'Asia/Ho_Chi_Minh';

export function quoteCodeYear(at: Date = new Date()): number {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: QT_CODE_TZ,
    year: 'numeric',
  }).format(at);
  return Number(formatted);
}

export function formatQuoteCode(year: number, seq: number): string {
  return `QT-PTT-${year}-${String(seq).padStart(6, '0')}`;
}
