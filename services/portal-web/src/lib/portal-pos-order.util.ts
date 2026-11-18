export type SellLine = {
  name: string;
  qty: number;
  price_vnd: number;
  available?: number | null;
};

/** Variant price when it is set; otherwise the product price. Never a typed amount. */
export function catalogUnitPrice(
  productPrice: number | null | undefined,
  variantPrice: number | null | undefined,
): number {
  const variant = Math.round(Number(variantPrice) || 0);
  if (variant > 0) return variant;
  const product = Math.round(Number(productPrice) || 0);
  return product > 0 ? product : 0;
}

export function inStockVariants<T extends { active?: boolean; available?: number | null }>(variants: T[]): T[] {
  return variants.filter((row) => row.active !== false && Number(row.available ?? 0) > 0);
}

/** Empty string means the order can be submitted. */
export function orderBlockReason(items: SellLine[], totalVnd: number): string {
  if (!items.length) return 'Chọn ít nhất một sản phẩm.';
  for (const item of items) {
    if (!(item.price_vnd > 0)) return `${item.name} chưa có giá bán.`;
    if (item.available != null && item.qty > item.available) {
      return `${item.name} chỉ còn ${Math.max(0, item.available)}.`;
    }
  }
  if (!(totalVnd > 0)) return 'Tổng đơn phải lớn hơn 0.';
  return '';
}
