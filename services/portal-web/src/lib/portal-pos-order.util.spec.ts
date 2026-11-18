import { describe, expect, it } from 'vitest';
import { catalogUnitPrice, inStockVariants, orderBlockReason } from './portal-pos-order.util';
import { computeLocalTotals } from '@/components/portal-pos/PortalPosOrderForm';

describe('portal order sell rules', () => {
  it('takes the variant price, else the product price', () => {
    expect(catalogUnitPrice(90000, 120000)).toBe(120000);
    expect(catalogUnitPrice(90000, 0)).toBe(90000);
    expect(catalogUnitPrice(0, null)).toBe(0);
  });

  it('keeps only variants that still have stock', () => {
    expect(
      inStockVariants([
        { color: 'Đen', available: 2, active: true },
        { color: 'Trắng', available: 0, active: true },
        { color: 'Xanh', available: 4, active: false },
      ]).map((row) => row.color),
    ).toEqual(['Đen']);
  });

  it('blocks chốt đơn when stock is short or the total is 0', () => {
    expect(orderBlockReason([{ name: 'Áo Thun Nam', qty: 100000, price_vnd: 0, available: 3 }], 0)).toBe(
      'Áo Thun Nam chưa có giá bán.',
    );
    expect(orderBlockReason([{ name: 'Áo Thun Nam', qty: 100000, price_vnd: 150000, available: 3 }], 150000)).toContain(
      'chỉ còn 3',
    );
    expect(orderBlockReason([{ name: 'Áo', qty: 1, price_vnd: 1000, available: 5 }], 0)).toBe('Tổng đơn phải lớn hơn 0.');
    expect(orderBlockReason([{ name: 'Áo', qty: 2, price_vnd: 1000, available: 5 }], 2000)).toBe('');
  });

  it('computes tạm tính and tổng/COD live', () => {
    expect(
      computeLocalTotals(
        [{ name: 'Áo', sku: 'A', color: '', size: '', qty: 2, price_vnd: 100000 }],
        10000,
        15000,
        5000,
      ),
    ).toEqual({
      subtotal_vnd: 200000,
      discount_vnd: 10000,
      shipping_fee_vnd: 15000,
      deposit_vnd: 5000,
      total_vnd: 205000,
      cod_vnd: 200000,
    });
  });
});
