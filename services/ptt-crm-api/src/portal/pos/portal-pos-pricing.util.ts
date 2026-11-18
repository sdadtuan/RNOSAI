import type { OrderTotals, OrderTotalsInput } from './portal-pos.types';

export class OrderSellError extends Error {
  constructor(
    readonly code: 'insufficient_stock' | 'zero_total' | 'price_missing' | 'product_not_found',
    message: string,
  ) {
    super(message);
    this.name = 'OrderSellError';
  }
}

/** Catalog price wins. Rejects a 0 price or a qty above remaining stock. */
export function assertSellableLine(input: {
  name: string;
  qty: number;
  catalogPrice: number | null;
  available: number | null;
}): { qty: number; price_vnd: number } {
  const name = String(input.name || 'Sản phẩm').trim() || 'Sản phẩm';
  const qty = Math.round(Number(input.qty));
  if (!Number.isFinite(qty) || qty < 1) {
    throw new OrderSellError('zero_total', 'Số lượng không hợp lệ.');
  }
  const price = Math.round(Number(input.catalogPrice) || 0);
  if (price <= 0) {
    throw new OrderSellError('price_missing', `${name} chưa có giá bán.`);
  }
  if (input.available != null && qty > input.available) {
    throw new OrderSellError(
      'insufficient_stock',
      `${name} chỉ còn ${Math.max(0, input.available)} (yêu cầu ${qty}).`,
    );
  }
  return { qty, price_vnd: price };
}

function money(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

/** Subtotal − discount + shipping = total; COD = total − deposit (floored at 0). */
export function computeOrderTotals(input: OrderTotalsInput): OrderTotals {
  const items = Array.isArray(input.items) ? input.items : [];
  const subtotal = items.reduce((sum, item) => {
    const qty = money(item?.qty);
    const price = money(item?.price_vnd);
    return sum + qty * price;
  }, 0);
  const discount = Math.min(money(input.discount_vnd), subtotal);
  const shipping = money(input.shipping_fee_vnd);
  const total = Math.max(0, subtotal - discount + shipping);
  const deposit = Math.min(money(input.deposit_vnd), total);
  const cod = Math.max(0, total - deposit);
  return {
    subtotal_vnd: subtotal,
    discount_vnd: discount,
    shipping_fee_vnd: shipping,
    deposit_vnd: deposit,
    total_vnd: total,
    cod_vnd: cod,
  };
}

export function formatVnd(value: number | null | undefined): string {
  const n = money(value);
  return `${new Intl.NumberFormat('vi-VN').format(n)} đ`;
}

/** Normalize VN phone to 0xxxxxxxxx (digits only, leading +84 → 0). */
export function normalizeVnPhone(raw: unknown): string {
  let s = String(raw ?? '').trim();
  if (!s) return '';
  s = s.replace(/[^\d+]/g, '');
  if (s.startsWith('+84')) s = `0${s.slice(3)}`;
  else if (s.startsWith('84') && s.length >= 11) s = `0${s.slice(2)}`;
  s = s.replace(/\D/g, '');
  if (s.length === 9 && !s.startsWith('0')) s = `0${s}`;
  return s.slice(0, 15);
}

export function isValidVnPhone(phone: string): boolean {
  const n = normalizeVnPhone(phone);
  return /^0\d{9,10}$/.test(n);
}
