import { formatQuoteCode, quoteCodeYear } from './quote-code.util';

describe('quote-code.util', () => {
  it('quote code pads 6', () => {
    expect(formatQuoteCode(2026, 89)).toBe('QT-PTT-2026-000089');
  });

  it('quote year uses Asia/Ho_Chi_Minh not UTC', () => {
    expect(quoteCodeYear(new Date('2026-12-31T20:00:00.000Z'))).toBe(2027);
    expect(quoteCodeYear(new Date('2026-12-31T16:00:00.000Z'))).toBe(2026);
  });
});
