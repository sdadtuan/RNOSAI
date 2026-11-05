import { isIsoDate, leadSearchPhoneDigits } from './lead-search.util';

describe('lead search', () => {
  it('normalizes spaced and +84 numbers to the last 9 digits', () => {
    expect(leadSearchPhoneDigits('0901 234 567')).toBe('901234567');
    expect(leadSearchPhoneDigits('+84 901-234-567')).toBe('901234567');
  });

  it('leaves a name as text', () => {
    expect(leadSearchPhoneDigits('Vân Biết')).toBeNull();
  });

  it('accepts only calendar dates', () => {
    expect(isIsoDate('2026-10-12')).toBe(true);
    expect(isIsoDate('12/10/2026')).toBe(false);
  });
});
