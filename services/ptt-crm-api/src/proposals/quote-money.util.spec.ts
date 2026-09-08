import { allocatePayment, calcGmBps, calcNsr, calcPayable } from './quote-money.util';

describe('quote-money.util', () => {
  it('GM null when NSR is 0', () => {
    expect(calcGmBps(0n, 1n)).toBeNull();
  });

  it('payment 50/30/20 remainder on last', () => {
    expect(allocatePayment(265647600n, [5000, 3000, 2000])).toEqual([
      132823800n, 79694280n, 53129520n,
    ]);
  });

  it('rejects media in NSR', () => {
    const nsr = calcNsr([{ itemType: 'fee', netVnd: 126000000n }, { itemType: 'media', netVnd: 120000000n }]);
    expect(nsr).toBe(126000000n);
  });

  it('puts rounding remainder on the last installment', () => {
    expect(allocatePayment(100n, [3333, 3333, 3334])).toEqual([33n, 33n, 34n]);
  });

  it('calcPayable applies VAT bps to fee plus media minus discount', () => {
    expect(
      calcPayable({ feeVnd: 100000000n, mediaVnd: 0n, discountVnd: 0n, vatBps: 800 }),
    ).toEqual({ taxVnd: 8000000n, payableVnd: 108000000n });
  });

  it('calcGmBps is round((nsr-cost)*10000/nsr)', () => {
    expect(calcGmBps(100n, 75n)).toBe(2500);
  });
});
