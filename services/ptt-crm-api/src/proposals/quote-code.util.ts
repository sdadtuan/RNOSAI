export function formatQuoteCode(year: number, seq: number): string {
  return `QT-PTT-${year}-${String(seq).padStart(6, '0')}`;
}
