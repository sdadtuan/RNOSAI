import { formatQuoteCode } from './quote-code.util';

describe('quote-code.util', () => {
  it('quote code pads 6', () => {
    expect(formatQuoteCode(2026, 89)).toBe('QT-PTT-2026-000089');
  });
});
