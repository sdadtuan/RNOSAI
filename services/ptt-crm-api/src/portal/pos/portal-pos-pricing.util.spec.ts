import { computeOrderTotals, isValidVnPhone, normalizeVnPhone } from './portal-pos-pricing.util';

describe('computeOrderTotals', () => {
  it('sums lines and derives COD after discount, shipping and deposit', () => {
    const totals = computeOrderTotals({
      items: [
        { qty: 2, price_vnd: 150000 },
        { qty: 1, price_vnd: 50000 },
      ],
      discount_vnd: 20000,
      shipping_fee_vnd: 30000,
      deposit_vnd: 100000,
    });
    expect(totals).toEqual({
      subtotal_vnd: 350000,
      discount_vnd: 20000,
      shipping_fee_vnd: 30000,
      deposit_vnd: 100000,
      total_vnd: 360000,
      cod_vnd: 260000,
    });
  });

  it('clips discount to subtotal and deposit to total, floors at zero', () => {
    expect(
      computeOrderTotals({
        items: [{ qty: 1, price_vnd: 10000 }],
        discount_vnd: 999999,
        shipping_fee_vnd: 0,
        deposit_vnd: 0,
      }),
    ).toMatchObject({ discount_vnd: 10000, total_vnd: 0, cod_vnd: 0 });

    expect(
      computeOrderTotals({
        items: [{ qty: 1, price_vnd: 50000 }],
        shipping_fee_vnd: 10000,
        deposit_vnd: 999999,
      }),
    ).toMatchObject({ total_vnd: 60000, deposit_vnd: 60000, cod_vnd: 0 });
  });

  it('treats invalid quantities and amounts as zero', () => {
    const totals = computeOrderTotals({
      items: [
        { qty: -3, price_vnd: 1000 },
        { qty: 2, price_vnd: -50 },
        { qty: 1.4, price_vnd: 1000.6 },
      ],
    });
    expect(totals.subtotal_vnd).toBe(1001);
  });
});

describe('normalizeVnPhone', () => {
  it('converts +84 and 84 prefixes to 0xxxxxxxxx', () => {
    expect(normalizeVnPhone('+84 90 000 0199')).toBe('0900000199');
    expect(normalizeVnPhone('84900000199')).toBe('0900000199');
    expect(normalizeVnPhone('0900000199')).toBe('0900000199');
  });

  it('validates VN mobiles', () => {
    expect(isValidVnPhone('0900000199')).toBe(true);
    expect(isValidVnPhone('12')).toBe(false);
    expect(isValidVnPhone('')).toBe(false);
  });
});
