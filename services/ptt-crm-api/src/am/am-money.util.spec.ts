import { formatVnd, monthlyRecurringVnd } from './am-money.util';

describe('am-money.util', () => {
  it('excludes media spend and project from MRR', () => {
    expect(
      monthlyRecurringVnd({
        billingType: 'media_spend',
        amountVnd: 50_000_000,
        startsOn: null,
        endsOn: null,
      }),
    ).toBeNull();
    expect(
      monthlyRecurringVnd({
        billingType: 'project',
        amountVnd: 120_000_000,
        startsOn: null,
        endsOn: null,
      }),
    ).toBeNull();
  });

  it('keeps monthly amount as MRR', () => {
    expect(
      monthlyRecurringVnd({
        billingType: 'monthly',
        amountVnd: 20_000_000,
        startsOn: null,
        endsOn: null,
      }),
    ).toBe(20_000_000);
  });

  it('formats missing money as em dash', () => {
    expect(formatVnd(null)).toBe('—');
  });
});
