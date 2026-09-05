import { describe, expect, it } from 'vitest';
import { amFinanceAmountDisplay, amFinanceDash } from './am-finance.util';

describe('am-finance hide amounts', () => {
  it('shows em dash when hidden or amount is null', () => {
    expect(amFinanceAmountDisplay(true, 20_000_000)).toBe('—');
    expect(amFinanceAmountDisplay(false, null)).toBe('—');
    expect(amFinanceAmountDisplay(true, null)).toBe('—');
    expect(amFinanceAmountDisplay(false, 20_000_000)).not.toBe('—');
  });

  it('dashes empty dates and keeps invoice numbers', () => {
    expect(amFinanceDash(null)).toBe('—');
    expect(amFinanceDash('')).toBe('—');
    expect(amFinanceDash('INV-011')).toBe('INV-011');
  });
});
