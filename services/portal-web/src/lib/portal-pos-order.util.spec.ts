import { describe, expect, it } from 'vitest';
import {
  catalogUnitPrice,
  inStockSizesForColor,
  inStockVariants,
  orderBlockReason,
  pendingAddReason,
  phoneBlockReason,
  resolvePickedVariant,
  colorAvailable,
  colorSwatch,
  hasVariantChoice,
  isPlaceholderImage,
  namedColors,
  resolvePosProductImage,
  sizesForColor,
  variantAvailableFor,
} from './portal-pos-order.util';
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

  it('validates Vietnamese phone (10 digits)', () => {
    expect(phoneBlockReason('')).toContain('Nhập');
    expect(phoneBlockReason('0912345678')).toBe('');
    expect(phoneBlockReason('912345678')).toContain('10');
    expect(phoneBlockReason('0212345678')).toContain('hợp lệ');
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

  it('resolves product image from variant, spec color, and product URL', () => {
    expect(
      resolvePosProductImage({
        image_url: '/api/portal/crm/media/p.jpg',
        variants: [{ color: 'Đen', image_url: '' }],
        spec: { colors: [{ name: 'Đen', image: '/api/portal/crm/media/c.png' }] },
      }, 'Đen'),
    ).toBe('/api/portal/crm/media/c.png');
    expect(resolvePosProductImage({ image_url: '', variants: [{ image_url: '/v.png' }] })).toBe('/v.png');
    expect(isPlaceholderImage('https://placehold.co/400x400/png?text=Kem')).toBe(true);
    expect(resolvePosProductImage({ image_url: 'https://placehold.co/400x400/png?text=Kem', variants: [] })).toBe('');
    expect(
      resolvePosProductImage({
        image_url: 'https://placehold.co/400',
        variants: [{ image_url: '/api/portal/crm/media/a.jpg' }],
      }),
    ).toBe('/api/portal/crm/media/a.jpg');
  });

  it('exposes color and size chips for the POS catalog fixtures', () => {
    const kem = [
      { color: '', size: '50g', available: 17, active: true },
      { color: 'Đen', size: 'S', available: 0, active: true },
      { color: 'Đỏ', size: 'M', available: 0, active: true },
      { color: 'Vàng', size: 'L', available: 0, active: true },
    ];
    expect(namedColors(kem)).toEqual(['Đen', 'Đỏ', 'Vàng']);
    expect(sizesForColor(kem, 'Đen')).toEqual(['S']);
    expect(colorAvailable(kem, 'Đen')).toBe(0);
    expect(colorSwatch('ĐEN')).toBe('#111827');
    expect(colorSwatch('Đỏ')).toBe('#dc2626');
    expect(colorSwatch('Vàng')).toBe('#eab308');

    const serum = [
      { color: 'Hồng', size: '', available: 24, active: true },
      { color: 'Trắng', size: '', available: 3, active: true },
    ];
    expect(namedColors(serum)).toEqual(['Hồng', 'Trắng']);
    expect(sizesForColor(serum, 'Hồng')).toEqual([]);
    expect(colorSwatch('Hồng')).toBe('#ec4899');
    expect(colorSwatch('Trắng')).toBe('#f4f4f5');
    expect(hasVariantChoice(serum)).toBe(true);

    const ao = [
      { color: 'ĐEN', size: 'S', available: 0, active: true },
      { color: 'ĐEN', size: 'M', available: 0, active: true },
      { color: 'ĐEN', size: 'L', available: 0, active: true },
    ];
    expect(namedColors(ao)).toEqual(['ĐEN']);
    expect(sizesForColor(ao, 'ĐEN')).toEqual(['S', 'M', 'L']);
    expect(hasVariantChoice([{ color: '', size: '', available: 4, active: true }])).toBe(false);
  });

  it('lists all sizes for a color including out-of-stock', () => {
    const rows = [
      { color: 'Đen', size: 'M', available: 2, active: true },
      { color: 'Đen', size: 'L', available: 0, active: true },
    ];
    expect(sizesForColor(rows, 'Đen')).toEqual(['M', 'L']);
    expect(variantAvailableFor(rows, 'Đen', 'L')).toBe(0);
  });

  it('limits sizes to the selected color stock', () => {
    const rows = [
      { color: 'Đen', size: 'M', available: 2, active: true },
      { color: 'Đen', size: 'L', available: 0, active: true },
      { color: 'Trắng', size: 'M', available: 5, active: true },
    ];
    expect(inStockSizesForColor(rows, 'Đen')).toEqual(['M']);
    expect(inStockSizesForColor(rows, 'Trắng')).toEqual(['M']);
  });

  it('requires an exact color and size match', () => {
    const rows = [
      { color: 'Đen', size: 'M', available: 2, active: true },
      { color: 'Đen', size: 'L', available: 2, active: true },
    ];
    expect(resolvePickedVariant(rows, 'Đen', 'L')?.size).toBe('L');
    expect(resolvePickedVariant(rows, 'Đen', '')).toBeUndefined();
  });

  it('explains why Thêm vào đơn failed', () => {
    expect(pendingAddReason('Áo', false, 0, 1, 0)).toContain('màu');
    expect(pendingAddReason('Áo', true, 0, 1, 3)).toContain('giá');
    expect(pendingAddReason('Áo', true, 1000, 9, 3)).toContain('tồn');
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
