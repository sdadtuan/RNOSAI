import type { OrderTotals, OrderTotalsInput } from './portal-pos.types';

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
